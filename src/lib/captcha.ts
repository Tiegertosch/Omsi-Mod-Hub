import { z } from "zod";

/**
 * Formulare, die Cap (Proof-of-Work-CAPTCHA) schützt. Der Bereich steckt in
 * der Challenge und im Token: Ein für „report“ gelöstes Token gilt nicht für
 * die Anmeldung.
 */
export const CAPTCHA_SCOPES = ["register", "login", "reset", "report"] as const;
export type CaptchaScope = (typeof CAPTCHA_SCOPES)[number];

export function isCaptchaScope(value: string): value is CaptchaScope {
  return (CAPTCHA_SCOPES as readonly string[]).includes(value);
}

/** Name des versteckten Felds, das das Widget im Formular füllt. */
export const CAPTCHA_FIELD = "cap-token";

/** Endpunkt-Präfix für das Widget (`data-cap-api-endpoint`); es hängt `challenge` bzw. `redeem` an. */
export function captchaEndpoint(scope: CaptchaScope): string {
  return `/api/cap/${scope}/`;
}

/**
 * Zerlegt ein Einmal-Token von capjs-core: `<id>:<Geheimteil>`, beides Hex.
 * Alles andere wird verworfen, bevor die Datenbank gefragt wird.
 */
export function parseCaptchaToken(value: unknown): { id: string; secret: string } | null {
  if (typeof value !== "string") return null;
  const match = /^([0-9a-f]{8,64}):([0-9a-f]{16,128})$/.exec(value);
  return match ? { id: match[1], secret: match[2] } : null;
}

/**
 * Antwort des Widgets auf eine Challenge (Format 1: eine Zahl pro Teilaufgabe).
 * Die Obergrenzen liegen weit über den Standardwerten (50 Teilaufgaben) und
 * begrenzen nur den Aufwand für manipulierte Anfragen.
 */
export const captchaRedeemSchema = z.object({
  token: z.string().min(1).max(4096),
  solutions: z.array(z.number().int().nonnegative()).min(1).max(500),
});
