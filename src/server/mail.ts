import "server-only";

import { enqueueMails, type QueueOptions } from "./mail-outbox";
import type { MailMessage } from "./mail-transport";

export type { MailMessage } from "./mail-transport";
export type { QueueOptions } from "./mail-outbox";

/**
 * E-Mail verschicken, ohne auf das Ergebnis zu warten: Die Mail landet in der
 * Warteschlange (src/server/mail-outbox.ts) und wird dort versendet und bei
 * Fehlern wiederholt. Die Funktion wartet bewusst nicht einmal auf das
 * Anlegen, damit Antwortzeiten nicht verraten, ob eine E-Mail-Adresse
 * registriert ist (auf manchen Wegen wird gar keine Mail angelegt).
 *
 * Codes und Links geben ihre Gültigkeit als `validMinutes` mit: Nach Ablauf
 * wird nicht mehr versendet.
 */
export function sendMailInBackground(message: MailMessage, options: QueueOptions = {}): void {
  enqueueMails([message], options).catch((error: unknown) => {
    console.error("[mail] Anlegen in der Warteschlange fehlgeschlagen:", error instanceof Error ? error.message : "unbekannter Fehler");
  });
}
