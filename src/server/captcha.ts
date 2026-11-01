import "server-only";

import { createHash } from "node:crypto";

import { generateChallenge, validateChallenge } from "capjs-core";

import { CAPTCHA_FIELD, parseCaptchaToken, type CaptchaScope } from "@/lib/captcha";
import { db } from "@/lib/db";

/**
 * Cap, selbst gehostet: capjs-core erzeugt und prüft die Challenges
 * (signierte JWTs), Wiederverwendungsschutz und Einmal-Tokens liegen in der
 * Tabelle CaptchaUse. Es geht nichts an Dritte.
 *
 * Ablauf: Widget holt eine Challenge (`/api/cap/<Bereich>/challenge`), löst
 * sie im Browser, löst sie gegen ein Token ein (`…/redeem`) und schickt es im
 * Feld `cap-token` mit dem Formular. Die Server Action verbraucht das Token
 * mit `consumeCaptcha` genau einmal.
 */

/** Gültigkeit eines eingelösten Tokens. Gelöst wird erst beim Absenden, das reicht also knapp. */
const TOKEN_TTL_MS = 5 * 60 * 1000;

function captchaSecret(): string {
  const secret = process.env.CAP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CAP_SECRET fehlt oder ist kürzer als 32 Zeichen. Siehe .env.example.");
  }
  return secret;
}

const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");
const tokenRow = (scope: CaptchaScope, id: string, secretHash: string) => `token:${scope}:${id}:${secretHash}`;

/** Neue Challenge mit den Standardwerten von capjs-core (Format 1, ohne Instrumentierung). */
export function createCaptchaChallenge(scope: CaptchaScope) {
  return generateChallenge(captchaSecret(), { scope });
}

/** Prüft die Lösung und gibt ein Einmal-Token aus; `null`, wenn die Lösung nicht gilt. */
export async function redeemCaptchaChallenge(
  scope: CaptchaScope,
  body: { token: string; solutions: number[] },
): Promise<{ token: string; expires: number } | null> {
  const result = await validateChallenge(captchaSecret(), body, {
    scope,
    tokenTtlMs: TOKEN_TTL_MS,
    // Jede Challenge nur einmal einlösen: Einfügen mit festem Schlüssel ist atomar.
    consumeNonce: async (signature, ttlMs) => {
      const { count } = await db.captchaUse.createMany({
        data: [{ key: `challenge:${signature}`, expiresAt: new Date(Date.now() + ttlMs) }],
        skipDuplicates: true,
      });
      return count === 1;
    },
  });
  if (!result.success) return null;

  // Gespeichert wird nur der Hash des Geheimteils (Format von capjs-core: tokenKey).
  const parsed = parseCaptchaToken(result.token);
  if (!parsed) throw new Error("capjs-core hat ein Token in unerwartetem Format geliefert.");
  await db.captchaUse.create({
    data: { key: tokenRow(scope, parsed.id, sha256Hex(parsed.secret)), expiresAt: new Date(result.expires) },
  });
  return { token: result.token, expires: result.expires };
}

/**
 * Verbraucht das Token aus dem Formular. `true` nur für ein gültiges, noch
 * nicht verwendetes Token dieses Bereichs; das Löschen ist atomar, ein Token
 * gilt also auch bei parallelen Anfragen genau einmal.
 */
export async function consumeCaptcha(scope: CaptchaScope, formData: FormData): Promise<boolean> {
  const parsed = parseCaptchaToken(formData.get(CAPTCHA_FIELD));
  if (!parsed) return false;
  const { count } = await db.captchaUse.deleteMany({
    where: { key: tokenRow(scope, parsed.id, sha256Hex(parsed.secret)), expiresAt: { gt: new Date() } },
  });
  return count === 1;
}
