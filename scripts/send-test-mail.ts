/**
 * Prüft die SMTP-Konfiguration (SMTP_URL, MAIL_FROM) und sendet eine Testmail:
 *
 *   pnpm mail:test empfaenger@example.com
 *
 * Nutzt nodemailer direkt (wie src/server/mail.ts), damit es ohne laufende App
 * funktioniert. Das Passwort aus SMTP_URL wird nie ausgegeben.
 */
import "dotenv/config";

import nodemailer from "nodemailer";

const [to] = process.argv.slice(2);

/** SMTP-URL ohne Zugangsdaten, für Ausgaben. */
function describe(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || (parsed.protocol === "smtps:" ? "465" : "587")}`;
  } catch {
    return "(ungültige URL)";
  }
}

/** Typische Fehler verständlich erklären. */
function hint(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const responseCode = typeof error === "object" && error && "responseCode" in error ? Number(error.responseCode) : 0;
  const message = error instanceof Error ? error.message : "";
  if (code === "EAUTH" || responseCode === 535) return "Anmeldung abgelehnt: Benutzername/Passwort prüfen (Sonderzeichen im Passwort URL-kodieren, z. B. @ → %40).";
  // nodemailer meldet Verbindungs- und TLS-Fehler beide als ESOCKET; die Ursache steht in der Meldung.
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH/.test(message) || code === "ECONNECTION" || code === "ETIMEDOUT") {
    return "Server nicht erreichbar: Host, Port und ausgehende Firewall prüfen.";
  }
  if (code === "ETLS" || /ssl|tls|certificate|wrong version/i.test(message)) {
    return "TLS-Fehler: Für Port 465 smtps:// verwenden, für Port 587 smtp:// (STARTTLS).";
  }
  if (code === "EENVELOPE" || responseCode === 550 || responseCode === 553) return "Absender abgelehnt: MAIL_FROM muss zum Postfach bzw. zur Domain des Kontos passen.";
  return "Details siehe Fehlermeldung oben.";
}

async function main() {
  const url = process.env.SMTP_URL;
  const from = process.env.MAIL_FROM;
  if (!to || !to.includes("@")) {
    console.error("Aufruf: pnpm mail:test <empfaenger@example.com>");
    process.exitCode = 1;
    return;
  }
  if (!url || !from) {
    console.error("SMTP_URL und MAIL_FROM müssen gesetzt sein (siehe deploy/env.production.example).");
    process.exitCode = 1;
    return;
  }

  console.log(`Verbinde mit ${describe(url)} …`);
  const transporter = nodemailer.createTransport(url);
  try {
    await transporter.verify();
    console.log("Verbindung und Anmeldung erfolgreich.");
    const info = await transporter.sendMail({
      from,
      to,
      subject: "Testmail – OMSI Mod Hub",
      text: "Diese Testmail bestätigt, dass der E-Mail-Versand von OMSI Mod Hub funktioniert.",
    });
    console.log(`Testmail an ${to} übergeben (Message-ID ${info.messageId}).`);
    console.log("Bitte auch den Spam-Ordner prüfen. Landet sie dort, SPF/DKIM der Domain beim Mail-Anbieter prüfen.");
  } catch (error) {
    console.error("Versand fehlgeschlagen:", error instanceof Error ? error.message : error);
    console.error(hint(error));
    process.exitCode = 1;
  } finally {
    transporter.close();
  }
}

main();
