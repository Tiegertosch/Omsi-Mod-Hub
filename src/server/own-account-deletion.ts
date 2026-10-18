import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { canDeleteOwnAccount } from "@/lib/account";
import { auth } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { deleteUserAccount, type DeletionReason } from "@/server/account-deletion";
import { mapAuthError } from "@/server/auth-errors";
import { accountDeletedEmail } from "@/server/emails";
import { sendMailInBackground } from "@/server/mail";
import { creatorChanged, projectsChanged } from "@/server/public-cache";
import { consumeRateLimits } from "@/server/rate-limit";
import type { CurrentUser } from "@/server/session";

/**
 * Gemeinsamer Ablauf zum Schließen des eigenen Kontos (Einstellungen und
 * abgelehnte Nutzungsbedingungen): Passwort prüfen, löschen, Caches erneuern,
 * Cookie entfernen, Bestätigungsmail, Weiterleitung. Nur aus Server Actions
 * aufrufen, die den Nutzer bereits ermittelt haben. Leitet bei Erfolg weiter.
 */
export async function deleteOwnAccount(input: {
  user: CurrentUser;
  password: string;
  locale: string;
  reason: DeletionReason;
}): Promise<FormState> {
  const { user, locale } = input;
  if (!canDeleteOwnAccount(user.role)) return { status: "error", code: "admin_account" };

  if (!(await consumeRateLimits([{ key: `delete:user:${user.id}`, limit: 5, windowMs: 15 * 60 * 1000 }]))) {
    return { status: "error", code: "rate_limit" };
  }

  const requestHeaders = await headers();
  try {
    await auth.api.verifyPassword({ body: { password: input.password }, headers: requestHeaders });
  } catch (error) {
    return { status: "error", code: mapAuthError(error) };
  }

  let deleted;
  try {
    deleted = await deleteUserAccount(user.id, input.reason);
  } catch (error) {
    console.error("[account] Löschen fehlgeschlagen:", error instanceof Error ? error.message : "unbekannt");
    return { status: "error", code: "generic" };
  }

  if (deleted.projectSlugs.length > 0) projectsChanged(deleted.projectSlugs);
  if (deleted.hadCreatorProfile) creatorChanged(user.username);

  // Die Session ist mit dem Konto gelöscht; hier wird nur noch das Cookie entfernt.
  try {
    await auth.api.signOut({ headers: requestHeaders });
  } catch {
    // Ein verbliebenes Cookie verweist auf keine Session mehr.
  }

  sendMailInBackground(accountDeletedEmail(user));
  redirect(`/${locale}/account-deleted`);
}
