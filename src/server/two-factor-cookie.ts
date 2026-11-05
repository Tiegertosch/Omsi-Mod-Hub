import "server-only";

import { cookies } from "next/headers";

import { auth } from "@/lib/auth";

/**
 * Wert des Challenge-Cookies zwischen Passwort und zweitem Faktor (null, wenn
 * keins da ist). Der Name kommt von Better Auth selbst, weil er mit HTTPS das
 * Präfix __Secure- trägt; ein fest eingetragener Name würde sonst produktiv
 * jede Anmeldung mit 2FA als „abgelaufen“ melden.
 */
export async function twoFactorChallenge(): Promise<string | null> {
  const [context, store] = await Promise.all([auth.$context, cookies()]);
  return store.get(context.createAuthCookie("two_factor").name)?.value ?? null;
}
