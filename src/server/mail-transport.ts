import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import nodemailer, { type Transporter } from "nodemailer";

import { DEFAULT_SMTP_INTERVAL_MS } from "@/lib/mail-queue";
import { siteConfig, smtpHeloName } from "@/lib/site";

/**
 * Eigentlicher Versand einer Mail. Aufgerufen nur von der Warteschlange
 * (src/server/mail-outbox.ts); Actions nutzen sendMailInBackground() aus
 * src/server/mail.ts.
 *
 * MAIL_TRANSPORT:
 *  - "smtp":    Versand über SMTP_URL (z. B. smtps://user:pass@mail.example.com:465)
 *  - "file":    nur Entwicklung – Mails werden als JSON in ./.dev-mail abgelegt
 *               (anderer Ordner über DEV_MAIL_DIR, z. B. ./.e2e-mail für die E2E-Tests)
 *  - "console": nur Entwicklung – Mails werden im Server-Log ausgegeben
 * Ohne Angabe gilt in der Entwicklung "file"; in Produktion muss ein
 * Transport konfiguriert sein, sonst schlägt der Versand fehl.
 */
/** `text` ist immer dabei; `html` ist die gestaltete Alternative (multipart/alternative). */
export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** zusätzliche Kopfzeilen, z. B. List-Unsubscribe */
  headers?: Record<string, string>;
};

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

/**
 * Kennung des Versandwegs dieses Servers. Entwicklungsserver und E2E-Server
 * teilen sich die lokale Datenbank, schreiben Mails aber in verschiedene
 * Ordner; jeder verschickt nur die Einträge mit seiner eigenen Kennung.
 */
export function mailChannel(): string {
  const transport = resolveTransport();
  if (transport === "file") return `file:${DEV_MAIL_DIR}`;
  return transport ?? "none";
}

/** Pause zwischen zwei Sendungen: nur bei SMTP (Limits des Mailanbieters). */
export function mailSendIntervalMs(): number {
  if (resolveTransport() !== "smtp") return 0;
  const configured = Number(process.env.MAIL_SEND_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_SMTP_INTERVAL_MS;
}

/**
 * Stundenlimit des Mailanbieters (MAIL_HOURLY_LIMIT, nur bei SMTP), z. B. 100
 * bei checkdomain Mail M. `null`: kein Limit.
 */
export function mailHourlyLimit(): number | null {
  if (resolveTransport() !== "smtp") return null;
  const configured = Number(process.env.MAIL_HOURLY_LIMIT);
  return Number.isInteger(configured) && configured > 0 ? configured : null;
}

let smtp: Transporter | null = null;

export async function deliverMail(message: MailMessage): Promise<void> {
  const transport = resolveTransport();

  if (transport === "smtp") {
    const url = process.env.SMTP_URL;
    const from = process.env.MAIL_FROM;
    if (!url || !from) throw new Error("MAIL_TRANSPORT=smtp erfordert SMTP_URL und MAIL_FROM.");
    smtp ??= nodemailer.createTransport({ url, name: smtpHeloName(siteConfig.url) });
    await smtp.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      headers: message.headers,
    });
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
