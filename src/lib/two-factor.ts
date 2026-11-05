/**
 * Zwei-Faktor-Anmeldung (Better-Auth-Plugin twoFactor): Authenticator-App
 * (TOTP) plus einmalige Backup-Codes. Pflicht für Admins, für alle anderen
 * freiwillig. Ohne Framework-Abhängigkeit, damit Client und Tests es nutzen
 * können.
 */

/** Anzahl der Backup-Codes; jeder gilt genau einmal. */
export const TWO_FACTOR_BACKUP_CODES = 10;
/** So lange gilt die Anmeldung nach Passwort, bis der zweite Faktor fehlt. */
export const TWO_FACTOR_LOGIN_MINUTES = 10;
export const TOTP_DIGITS = 6;

/** 6 Ziffern; Leerzeichen (z. B. „123 456“ aus der App) werden entfernt. */
export function normalizeTotpCode(input: string): string | null {
  const code = input.replace(/\s/g, "");
  return new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(code) ? code : null;
}

/**
 * Backup-Codes haben die Form „abcde-12345“ (Groß- und Kleinbuchstaben,
 * Ziffern). Leerzeichen werden entfernt, ein fehlender Bindestrich ergänzt.
 */
export function normalizeBackupCode(input: string): string | null {
  const code = input.replace(/\s/g, "");
  if (/^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/.test(code)) return code;
  if (/^[A-Za-z0-9]{10}$/.test(code)) return `${code.slice(0, 5)}-${code.slice(5)}`;
  return null;
}

/** Das Secret aus der otpauth-URI zum manuellen Eintragen, in Vierergruppen. */
export function totpSecretFromUri(uri: string): string | null {
  try {
    const url = new URL(uri);
    if (url.protocol !== "otpauth:") return null;
    const secret = url.searchParams.get("secret");
    if (!secret || !/^[A-Z2-7]+=*$/.test(secret)) return null;
    return secret.replace(/=+$/, "").replace(/(.{4})(?=.)/g, "$1 ");
  } catch {
    return null;
  }
}

/**
 * E-Mail-Adresse aus dem Bestätigungslink von Better Auth (JWT, Feld `email`).
 * Nur zur Weichenstellung im Hook – die Signatur prüft Better Auth danach
 * selbst; ein gefälschtes Token führt dort zu einem Fehler.
 */
export function emailOfVerificationToken(token: unknown): string | null {
  if (typeof token !== "string" || token.length > 4096) return null;
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const data: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const email = (data as { email?: unknown } | null)?.email;
    return typeof email === "string" && email.length <= 254 ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}
