import "server-only";

import { cookies } from "next/headers";

/**
 * Merkt sich nach Registrierung oder Anmeldung eines unbestätigten Kontos die
 * Adresse, damit die Code-Seite sie vorausfüllen kann – ohne sie in die URL zu
 * schreiben (Logs, Verlauf). Das Cookie ist nur eine Komfortfunktion: Die
 * Adresse bleibt auf der Seite änderbar und wird bei jeder Eingabe neu geprüft.
 */
const COOKIE = "omh-pending-email";

export async function rememberPendingEmail(email: string): Promise<void> {
  (await cookies()).set(COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function readPendingEmail(): Promise<string> {
  const value = (await cookies()).get(COOKIE)?.value ?? "";
  return value.length <= 254 ? value : "";
}

export async function clearPendingEmail(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
