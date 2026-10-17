import "server-only";

import { cookies } from "next/headers";

/**
 * Merkt sich nach Registrierung oder Anmeldung eines unbestätigten Kontos
 * Benutzername und Adresse: Die Code-Seite zeigt die Adresse an, und „E-Mail-
 * Adresse bearbeiten“ füllt Schritt 1 damit vor – ohne beides in die URL zu
 * schreiben (Logs, Verlauf). Das Cookie ist nur eine Komfortfunktion und
 * berechtigt zu nichts; jede Aktion prüft Code bzw. Passwort selbst.
 */
const COOKIE = "omh-pending-registration";

export type PendingRegistration = { email: string; username: string };

export async function rememberPendingRegistration(pending: PendingRegistration): Promise<void> {
  (await cookies()).set(COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function readPendingRegistration(): Promise<PendingRegistration | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw || raw.length > 600) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingRegistration>;
    if (typeof value.email !== "string" || typeof value.username !== "string") return null;
    if (value.email.length > 254 || value.username.length > 64) return null;
    return { email: value.email, username: value.username };
  } catch {
    return null;
  }
}

export async function clearPendingRegistration(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
