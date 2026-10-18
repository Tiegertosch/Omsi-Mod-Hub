import "server-only";

import { RESEND_COOLDOWN_MINUTES } from "@/lib/auth-rules";
import { consumeRateLimit, hashKey, rateLimitResetAt } from "@/server/rate-limit";

/**
 * Sperre zwischen zwei Bestätigungscodes an dieselbe Adresse (gegen Mail-Spam).
 * Greift nach „Code erneut senden“ und nach der Anmeldung eines unbestätigten
 * Kontos; der Code der Registrierung selbst startet sie nicht.
 */
const COOLDOWN_MS = RESEND_COOLDOWN_MINUTES * 60 * 1000;
const cooldownKey = (email: string) => `verify-resend:id:${hashKey(email)}`;

/** Ab wann wieder ein Code an diese Adresse gehen darf, oder `null`, wenn sofort. */
export function resendRetryAt(email: string): Promise<number | null> {
  return rateLimitResetAt(cooldownKey(email), 1, COOLDOWN_MS);
}

/** Startet die Sperre; `false`, wenn sie noch läuft (dann keinen Code senden). */
export function startResendCooldown(email: string): Promise<boolean> {
  return consumeRateLimit(cooldownKey(email), 1, COOLDOWN_MS);
}

/** Für die Code-Seite: Ende der Sperre (oder null) und die Serverzeit des Renderings. */
export async function resendCooldownForPage(email: string | null): Promise<{ retryAt: number | null; now: number }> {
  return { retryAt: email ? await resendRetryAt(email) : null, now: Date.now() };
}
