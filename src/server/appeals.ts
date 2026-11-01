import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { appealDeadline } from "@/lib/appeals";

/**
 * Geheimes Token für den Widerspruchslink. Nur der Hash landet in der
 * Datenbank; wer den Link hat, darf widersprechen (gesperrte oder abgemeldete
 * Creator brauchen dafür kein Konto-Login).
 */
export function newAppealToken(now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashAppealToken(token), until: appealDeadline(now) };
}

export function hashAppealToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Pfad der Widerspruchsseite; das Token steht im Query-String wie beim Passwort-Reset. */
export function appealPath(locale: string, token: string): string {
  return `/${locale}/appeal?token=${token}`;
}
