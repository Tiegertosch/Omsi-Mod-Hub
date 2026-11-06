import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Abmeldelinks für Benachrichtigungen bei neuen Versionen. Der Link enthält
 * die Konto-ID und eine HMAC-Signatur mit BETTER_AUTH_SECRET: Er funktioniert
 * ohne Anmeldung und ohne gespeichertes Token, lässt sich aber nicht für
 * fremde Konten erzeugen. Wird das Secret gewechselt, verlieren alte Links
 * ihre Gültigkeit (Abmelden geht dann weiter über die Einstellungen).
 */

const PURPOSE = "project-updates";

export function unsubscribeSignature(secret: string, userId: string): string {
  return createHmac("sha256", secret).update(`${PURPOSE}:${userId}`).digest("base64url");
}

export function isValidUnsubscribe(secret: string, userId: unknown, signature: unknown): userId is string {
  if (typeof userId !== "string" || typeof signature !== "string") return false;
  if (userId.length === 0 || userId.length > 64 || signature.length > 64) return false;
  const expected = Buffer.from(unsubscribeSignature(secret, userId));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Pfad der Abmeldeseite (Bestätigung per Knopf, damit Link-Scanner nichts auslösen). */
export function unsubscribePath(locale: string, userId: string, signature: string): string {
  return `/${locale}/unsubscribe?${new URLSearchParams({ u: userId, s: signature }).toString()}`;
}

/** Ziel für List-Unsubscribe-Post (RFC 8058, Abmelden mit einem Klick im Mailprogramm). */
export function oneClickUnsubscribePath(userId: string, signature: string): string {
  return `/api/unsubscribe?${new URLSearchParams({ u: userId, s: signature }).toString()}`;
}
