import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { db } from "@/lib/db";

/**
 * Rate-Limit für Server Actions (Fixed Window), gespeichert in der Tabelle
 * RateLimit mit dem Präfix "app:". Direkte Aufrufe von auth.api.* aus Server
 * Actions umgehen das HTTP-Rate-Limit von Better Auth – deshalb ist dieses
 * Limit dort Pflicht.
 */
export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const fullKey = `app:${key}`;
  const now = Date.now();
  const row = await db.rateLimit.findUnique({ where: { key: fullKey } });

  if (!row || now - Number(row.lastRequest) >= windowMs) {
    await db.rateLimit.upsert({
      where: { key: fullKey },
      create: { key: fullKey, count: 1, lastRequest: BigInt(now) },
      update: { count: 1, lastRequest: BigInt(now) },
    });
    return true;
  }
  if (row.count >= limit) return false;
  await db.rateLimit.update({ where: { key: fullKey }, data: { count: { increment: 1 } } });
  return true;
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
