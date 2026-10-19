/**
 * Löschfristen für Betriebsdaten (siehe scripts/cleanup-data.ts, täglich per
 * systemd-Timer). Diese Werte gehören in die Datenschutzerklärung.
 *
 * - Rate-Limit-Zähler: Better Auth speichert dort die IP-Adresse im Klartext,
 *   die eigenen Limits nur gehasht. Das längste Zeitfenster ist eine Stunde;
 *   nach 24 Stunden wird ein Eintrag nicht mehr gebraucht.
 * - Sitzungen (IP-Adresse, Browser) und Codes/Links: sobald abgelaufen.
 * - Nie bestätigte Konten: nach 7 Tagen.
 * - Abgeschlossene Meldungen (erledigt/verworfen, mit Freitext und ggf.
 *   Konto): 6 Monate nach dem Abschluss. Offene Meldungen bleiben.
 * - Protokoll (Audit-Log, Konto-IDs der Handelnden): nach 12 Monaten.
 */
export const RATE_LIMIT_RETENTION_HOURS = 24;
export const UNVERIFIED_ACCOUNT_RETENTION_DAYS = 7;
export const CLOSED_REPORT_RETENTION_MONTHS = 6;
export const AUDIT_LOG_RETENTION_MONTHS = 12;

const HOUR = 60 * 60 * 1000;

function monthsBefore(now: Date, months: number): Date {
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date;
}

export function retentionCutoffs(now: Date) {
  return {
    /** Rate-Limit-Einträge mit letzter Anfrage davor werden gelöscht (Unix-ms wie in der Tabelle). */
    rateLimitBefore: BigInt(now.getTime() - RATE_LIMIT_RETENTION_HOURS * HOUR),
    /** Unbestätigte Konten, die davor angelegt wurden, werden gelöscht. */
    unverifiedAccountBefore: new Date(now.getTime() - UNVERIFIED_ACCOUNT_RETENTION_DAYS * 24 * HOUR),
    /** Meldungen, die davor abgeschlossen wurden, werden gelöscht. */
    closedReportBefore: monthsBefore(now, CLOSED_REPORT_RETENTION_MONTHS),
    /** Protokolleinträge davor werden gelöscht. */
    auditLogBefore: monthsBefore(now, AUDIT_LOG_RETENTION_MONTHS),
  };
}
