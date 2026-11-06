/**
 * Regeln der Mail-Warteschlange (src/server/mail-outbox.ts), ohne Framework-Abhängigkeit.
 */

const MINUTE = 60 * 1000;

/** Ohne eigene Gültigkeit (Codes, Links) wird eine Mail so lange erneut versucht. */
export const DEFAULT_MAIL_VALID_HOURS = 48;
/** Danach gilt eine Mail als endgültig gescheitert. */
export const MAX_MAIL_ATTEMPTS = 12;
/** Ab so vielen Fehlversuchen meldet /api/health/mail einen Fehler. */
export const MAIL_ALERT_ATTEMPTS = 3;
/** Endgültig gescheiterte Einträge (ohne Inhalt) werden danach gelöscht. */
export const FAILED_MAIL_RETENTION_DAYS = 7;
/** So lange bleibt ein Eintrag für einen Versandlauf reserviert. */
export const MAIL_LOCK_MINUTES = 5;
/** Abstand zwischen zwei SMTP-Sendungen, falls MAIL_SEND_INTERVAL_MS nicht gesetzt ist. */
export const DEFAULT_SMTP_INTERVAL_MS = 2000;

/** Prioritäten: Codes und Kontomails vor Benachrichtigungen. */
export const MAIL_PRIORITY = { account: 0, bulk: 1 } as const;

/** Anteil des Stundenlimits, den Benachrichtigungen nutzen dürfen; der Rest bleibt für Codes und Kontomails. */
export const BULK_SHARE_OF_HOURLY_LIMIT = 0.8;

/**
 * Welche Mails im Moment verschickt werden dürfen, gemessen an den
 * Sendeversuchen der letzten Stunde: alle (höchste erlaubte Priorität 1), nur
 * Codes und Kontomails (0) oder keine (`null`). Ohne Limit immer alle.
 */
export function allowedMailPriority(sentLastHour: number, hourlyLimit: number | null): number | null {
  if (hourlyLimit === null) return MAIL_PRIORITY.bulk;
  if (sentLastHour >= hourlyLimit) return null;
  if (sentLastHour >= Math.floor(hourlyLimit * BULK_SHARE_OF_HOURLY_LIMIT)) return MAIL_PRIORITY.account;
  return MAIL_PRIORITY.bulk;
}

/** Wartezeit vor dem nächsten Versuch nach `attempts` Fehlversuchen: 1, 2, 5, 10, 30, 60 Minuten, danach alle 3 Stunden. */
export function mailRetryDelayMs(attempts: number): number {
  const steps = [1, 2, 5, 10, 30, 60];
  const minutes = steps[Math.max(0, attempts - 1)] ?? 180;
  return minutes * MINUTE;
}

/** Ablaufzeit einer Mail: eigene Gültigkeit in Minuten oder DEFAULT_MAIL_VALID_HOURS. */
export function mailExpiresAt(now: Date, validMinutes?: number): Date {
  const minutes = validMinutes && validMinutes > 0 ? validMinutes : DEFAULT_MAIL_VALID_HOURS * 60;
  return new Date(now.getTime() + minutes * MINUTE);
}

export type RetryDecision = { kind: "retry"; nextAttemptAt: Date } | { kind: "fail" };

/** Nach einem Fehlversuch: erneut versuchen oder aufgeben (zu viele Versuche oder nächster Versuch nach Ablauf). */
export function decideRetry(attempts: number, now: Date, expiresAt: Date): RetryDecision {
  if (attempts >= MAX_MAIL_ATTEMPTS) return { kind: "fail" };
  const next = new Date(now.getTime() + mailRetryDelayMs(attempts));
  return next > expiresAt ? { kind: "fail" } : { kind: "retry", nextAttemptAt: next };
}

/**
 * Fehlercode ohne personenbezogene Daten. SMTP-Antworten nennen oft die
 * Empfängeradresse („550 5.1.1 <name@example.com> unknown“); gespeichert
 * werden deshalb nur der Code von nodemailer und der SMTP-Statuscode.
 */
export function mailErrorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) return "unknown";
  const record = error as { code?: unknown; responseCode?: unknown };
  const code = typeof record.code === "string" && /^[A-Z_]{2,32}$/.test(record.code) ? record.code : "error";
  const response = typeof record.responseCode === "number" && Number.isInteger(record.responseCode) ? `:${record.responseCode}` : "";
  return `${code}${response}`;
}
