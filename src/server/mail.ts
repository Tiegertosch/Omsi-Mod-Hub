import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import nodemailer, { type Transporter } from "nodemailer";

/**
 * E-Mail-Versand.
 *
 * MAIL_TRANSPORT:
 *  - "smtp":    Versand über SMTP_URL (z. B. smtps://user:pass@mail.example.com:465)
 *  - "file":    nur Entwicklung – Mails werden als JSON in ./.dev-mail abgelegt
 *               (anderer Ordner über DEV_MAIL_DIR, z. B. ./.e2e-mail für die E2E-Tests)
 *  - "console": nur Entwicklung – Mails werden im Server-Log ausgegeben
 * Ohne Angabe gilt in der Entwicklung "file"; in Produktion muss ein
 * Transport konfiguriert sein, sonst schlägt der Versand fehl.
 */
export type MailMessage = { to: string; subject: string; text: string };

type Transport = "smtp" | "file" | "console";

// Laufzeit-Verzeichnis: vom Build-Tracing ausnehmen (turbopackIgnore), wie in src/server/storage.ts.
export const DEV_MAIL_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.DEV_MAIL_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), ".dev-mail"),
);

function resolveTransport(): Transport | null {
  const configured = process.env.MAIL_TRANSPORT;
  if (configured === "smtp" || configured === "file" || configured === "console") return configured;
  return process.env.NODE_ENV === "production" ? null : "file";
}

let smtp: Transporter | null = null;

export async function sendMail(message: MailMessage): Promise<void> {
  const transport = resolveTransport();

  if (transport === "smtp") {
    const url = process.env.SMTP_URL;
    const from = process.env.MAIL_FROM;
    if (!url || !from) throw new Error("MAIL_TRANSPORT=smtp erfordert SMTP_URL und MAIL_FROM.");
    smtp ??= nodemailer.createTransport(url);
    await smtp.sendMail({ from, to: message.to, subject: message.subject, text: message.text });
    return;
  }

  if (transport === "file") {
    await mkdir(DEV_MAIL_DIR, { recursive: true });
    const file = path.join(DEV_MAIL_DIR, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
    await writeFile(file, JSON.stringify({ ...message, sentAt: new Date().toISOString() }, null, 2), "utf8");
    console.info(`[mail:file] ${message.subject} → ${message.to} (${path.basename(file)})`);
    return;
  }

  if (transport === "console") {
    console.info(`[mail:console] An: ${message.to}\nBetreff: ${message.subject}\n\n${message.text}`);
    return;
  }

  throw new Error("Kein E-Mail-Transport konfiguriert (MAIL_TRANSPORT).");
}

/**
 * Versand ohne auf das Ergebnis zu warten: verhindert, dass Antwortzeiten
 * verraten, ob eine E-Mail-Adresse registriert ist. Fehler werden protokolliert.
 */
export function sendMailInBackground(message: MailMessage): void {
  sendMail(message).catch((error: unknown) => {
    console.error("[mail] Versand fehlgeschlagen:", error instanceof Error ? error.message : "unbekannter Fehler");
  });
}
