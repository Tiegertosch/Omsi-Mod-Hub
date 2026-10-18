import "server-only";

import { RESEND_COOLDOWN_MINUTES } from "@/lib/auth-rules";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountExistsEmail } from "@/server/emails";
import { sendMailInBackground } from "@/server/mail";
import { consumeRateLimit, hashKey } from "@/server/rate-limit";

/**
 * Registrierung mit einer Adresse, zu der es schon ein Konto gibt. Nach außen
 * sieht das aus wie eine neue Registrierung (kein Ausspähen, wer registriert
 * ist); stattdessen erfährt der Inhaber der Adresse per Mail, dass er schon ein
 * Konto hat, mit Links zum Anmelden und Zurücksetzen des Passworts.
 *
 * Ausnahme: Dieselbe Person schickt ihre eigene, noch unbestätigte
 * Registrierung erneut ab (gleicher Benutzername) – dann `null`, und der
 * normale Ablauf schickt einen neuen Code.
 */
export async function findExistingAccount(email: string, username: string) {
  const account = await db.user.findUnique({
    where: { email },
    select: { email: true, name: true, username: true, emailVerified: true, preferredLocale: true, isSample: true },
  });
  if (!account || (account.username === username && !account.emailVerified)) return null;
  return account;
}

type ExistingAccount = NonNullable<Awaited<ReturnType<typeof findExistingAccount>>>;

export async function notifyExistingAccount(account: ExistingAccount, password: string): Promise<void> {
  // Eine echte Registrierung berechnet den Passwort-Hash; ohne ihn wäre die
  // Antwort messbar schneller und verriete, dass die Adresse vergeben ist.
  await (await auth.$context).password.hash(password);
  if (account.isSample) return;
  // Eigene Sperre, nicht die für „Code erneut senden“: deren Countdown zeigt die
  // Code-Seite an und würde sonst verraten, dass hier eine Mail verschickt wurde.
  const allowed = await consumeRateLimit(`account-exists:id:${hashKey(account.email)}`, 1, RESEND_COOLDOWN_MINUTES * 60 * 1000);
  if (allowed) sendMailInBackground(accountExistsEmail(account));
}
