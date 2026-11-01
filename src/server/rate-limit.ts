import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { headers } from "next/headers";

import { db } from "@/lib/db";

/**
 * Rate-Limit für Server Actions (Fixed Window), gespeichert in der Tabelle
 * RateLimit mit dem Präfix "app:". Direkte Aufrufe von auth.api.* aus Server
 * Actions umgehen das HTTP-Rate-Limit von Better Auth – deshalb ist dieses
 * Limit dort Pflicht.
 *
 * Prüfen und Zählen sind eine einzige Anweisung: Die Zeile ist während des
 * ON CONFLICT gesperrt, parallele Anfragen können also nicht beide denselben
 * alten Zählerstand sehen. Ist das Limit erreicht, greift die WHERE-Bedingung
 * nicht, es wird nichts geändert und RETURNING liefert keine Zeile.
 */
export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const fullKey = `app:${key}`;
  const now = BigInt(Date.now());
  const window = BigInt(windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("id", "key", "count", "lastRequest")
    VALUES (${randomUUID()}, ${fullKey}, 1, ${now}::bigint)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN ${now}::bigint - "RateLimit"."lastRequest" >= ${window}::bigint
        THEN 1 ELSE "RateLimit"."count" + 1 END,
      "lastRequest" = CASE WHEN ${now}::bigint - "RateLimit"."lastRequest" >= ${window}::bigint
        THEN EXCLUDED."lastRequest" ELSE "RateLimit"."lastRequest" END
    WHERE ${now}::bigint - "RateLimit"."lastRequest" >= ${window}::bigint
      OR "RateLimit"."count" < ${limit}::integer
    RETURNING "count"`;
  return rows.length > 0;
}

/**
 * Zeitpunkt (Unix-ms), ab dem das Limit wieder frei ist – `null`, wenn es
 * gerade nicht ausgeschöpft ist. Zählt selbst nichts.
 */
export async function rateLimitResetAt(key: string, limit: number, windowMs: number): Promise<number | null> {
  const row = await db.rateLimit.findUnique({ where: { key: `app:${key}` } });
  if (!row || row.count < limit) return null;
  const resetAt = Number(row.lastRequest) + windowMs;
  return resetAt > Date.now() ? resetAt : null;
}

/** Prüft mehrere Limits; alle müssen eingehalten werden. */
export async function consumeRateLimits(rules: { key: string; limit: number; windowMs: number }[]) {
  let allowed = true;
  for (const rule of rules) {
    // Alle Zähler erhöhen, damit Angriffe auf mehreren Achsen gezählt werden.
    if (!(await consumeRateLimit(rule.key, rule.limit, rule.windowMs))) allowed = false;
  }
  return allowed;
}

export function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/**
 * Gehashter Client-Schlüssel; die IP-Adresse selbst wird nicht gespeichert.
 * Hinweis: X-Forwarded-For ist nur hinter einem vertrauenswürdigen Reverse Proxy belastbar.
 */
export async function clientKey(scope: string): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return `${scope}:ip:${hashKey(ip)}`;
}
