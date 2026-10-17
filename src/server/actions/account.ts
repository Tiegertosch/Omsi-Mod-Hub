"use server";

import { refresh } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { canDeleteOwnAccount, deletionConfirmed } from "@/lib/account";
import { auth } from "@/lib/auth";
import { DISPLAY_NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth-rules";
import { db } from "@/lib/db";
import { fieldErrorsFrom, type FormState } from "@/lib/form-state";
import { deleteUserAccount } from "@/server/account-deletion";
import { mapAuthError } from "@/server/auth-errors";
import { accountDeletedEmail } from "@/server/emails";
import { sendMailInBackground } from "@/server/mail";
import { creatorChanged, projectsChanged } from "@/server/public-cache";
import { consumeRateLimits } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/session";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const localeSchema = z.enum(routing.locales).catch(routing.defaultLocale);

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "name" })
    .max(DISPLAY_NAME_MAX, { message: "name" })
    // keine Steuerzeichen
    .regex(/^[^\u0000-\u001f\u007f]+$/, { message: "name" }),
  preferredLocale: z.enum(routing.locales, { message: "locale" }),
});

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  // Jede Action prüft die Session selbst – UI-Prüfungen schützen keine Daten.
  const user = await getCurrentUser();
  if (!user) return { status: "error", code: "unauthorized" };

  const values = { name: text(formData, "name"), preferredLocale: text(formData, "preferredLocale") };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", code: "validation", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  if (!(await consumeRateLimits([{ key: `profile:user:${user.id}`, limit: 20, windowMs: 10 * 60 * 1000 }]))) {
    return { status: "error", code: "rate_limit", values };
  }

  try {
    await auth.api.updateUser({ body: parsed.data, headers: await headers() });
  } catch (error) {
    return { status: "error", code: mapAuthError(error), values };
  }

  // Spracheinstellung auch für Gastseiten übernehmen (Cookie von next-intl).
  (await cookies()).set("NEXT_LOCALE", parsed.data.preferredLocale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  const currentLocale = text(formData, "locale");
  if (parsed.data.preferredLocale !== currentLocale) {
    redirect(`/${parsed.data.preferredLocale}/dashboard/settings`);
  }
  return { status: "success" };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "required" }).max(PASSWORD_MAX, { message: "password" }),
    newPassword: z
      .string()
      .min(PASSWORD_MIN, { message: "password" })
      .max(PASSWORD_MAX, { message: "password" }),
    newPasswordConfirm: z.string(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    path: ["newPasswordConfirm"],
    message: "passwordConfirm",
  });

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", code: "unauthorized" };

  const parsed = passwordSchema.safeParse({
    currentPassword: text(formData, "currentPassword"),
    newPassword: text(formData, "newPassword"),
    newPasswordConfirm: text(formData, "newPasswordConfirm"),
  });
  if (!parsed.success) {
    return { status: "error", code: "validation", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  if (!(await consumeRateLimits([{ key: `password:user:${user.id}`, limit: 5, windowMs: 15 * 60 * 1000 }]))) {
    return { status: "error", code: "rate_limit" };
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: formData.get("revokeOtherSessions") === "on",
      },
      headers: await headers(),
    });
  } catch (error) {
    return { status: "error", code: mapAuthError(error) };
  }
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// E-Mail-Adresse ändern
// ---------------------------------------------------------------------------

const changeEmailSchema = z.object({
  newEmail: z.string().trim().toLowerCase().pipe(z.email({ message: "email" }).max(254, { message: "email" })),
  currentPassword: z.string().min(1, { message: "required" }).max(PASSWORD_MAX, { message: "password" }),
});

/**
 * Startet die zweistufige Änderung: Better Auth schickt einen Link an die
 * bisherige Adresse, danach einen an die neue. Erst der zweite Link übernimmt
 * die Adresse. Ist die neue Adresse schon vergeben, sieht die Antwort gleich
 * aus (Schutz vor Ausspähen), es wird aber nichts verschickt.
 */
export async function changeEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", code: "unauthorized" };

  const locale = localeSchema.parse(text(formData, "locale"));
  const values = { newEmail: text(formData, "newEmail") };
  const parsed = changeEmailSchema.safeParse({ ...values, currentPassword: text(formData, "currentPassword") });
  if (!parsed.success) {
    return { status: "error", code: "validation", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  if (parsed.data.newEmail === user.email) {
    return { status: "error", code: "validation", fieldErrors: { newEmail: "emailSame" }, values };
  }

  if (!(await consumeRateLimits([{ key: `email-change:user:${user.id}`, limit: 5, windowMs: HOUR }]))) {
    return { status: "error", code: "rate_limit", values };
  }

  try {
    const requestHeaders = await headers();
    await auth.api.verifyPassword({ body: { password: parsed.data.currentPassword }, headers: requestHeaders });
    await auth.api.changeEmail({
      body: { newEmail: parsed.data.newEmail, callbackURL: `/${locale}/dashboard/settings?emailChange=1` },
      headers: requestHeaders,
    });
  } catch (error) {
    return { status: "error", code: mapAuthError(error), values };
  }
  return { status: "success", message: user.email };
}

// ---------------------------------------------------------------------------
// Sitzungen
// ---------------------------------------------------------------------------

const sessionIdSchema = z.string().min(1).max(64);

/**
 * Beendet eine andere Sitzung des eigenen Kontos. Direkt in der Datenbank:
 * Better Auth prüft jede Anfrage gegen die Tabelle (kein Cookie-Cache, kein
 * Secondary Storage), die Sitzung ist damit sofort ungültig.
 */
export async function revokeSessionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", code: "unauthorized" };

  const id = sessionIdSchema.safeParse(formData.get("sessionId"));
  // Die aktuelle Sitzung endet über „Abmelden“.
  if (!id.success || id.data === user.sessionId) return { status: "error", code: "generic" };

  if (!(await consumeRateLimits([{ key: `sessions:user:${user.id}`, limit: 30, windowMs: 10 * MINUTE }]))) {
    return { status: "error", code: "rate_limit" };
  }
  await db.session.deleteMany({ where: { id: id.data, userId: user.id } });
  refresh();
  return { status: "success" };
}

export async function revokeOtherSessionsAction(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", code: "unauthorized" };

  if (!(await consumeRateLimits([{ key: `sessions:user:${user.id}`, limit: 30, windowMs: 10 * MINUTE }]))) {
    return { status: "error", code: "rate_limit" };
  }
  await db.session.deleteMany({ where: { userId: user.id, id: { not: user.sessionId } } });
  refresh();
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Konto löschen
// ---------------------------------------------------------------------------

const deleteAccountSchema = z.object({
  password: z.string().min(1, { message: "required" }).max(PASSWORD_MAX, { message: "password" }),
  confirmUsername: z.string().max(64, { message: "confirmUsername" }),
});

export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", code: "unauthorized" };
  if (!canDeleteOwnAccount(user.role)) return { status: "error", code: "admin_account" };

  const locale = localeSchema.parse(text(formData, "locale"));
  const parsed = deleteAccountSchema.safeParse({
    password: text(formData, "password"),
    confirmUsername: text(formData, "confirmUsername"),
  });
  if (!parsed.success) {
    return { status: "error", code: "validation", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  if (!deletionConfirmed(parsed.data.confirmUsername, user.username)) {
    return { status: "error", code: "validation", fieldErrors: { confirmUsername: "confirmUsername" } };
  }

  if (!(await consumeRateLimits([{ key: `delete:user:${user.id}`, limit: 5, windowMs: 15 * MINUTE }]))) {
    return { status: "error", code: "rate_limit" };
  }

  const requestHeaders = await headers();
  try {
    await auth.api.verifyPassword({ body: { password: parsed.data.password }, headers: requestHeaders });
  } catch (error) {
    return { status: "error", code: mapAuthError(error) };
  }

  let deleted;
  try {
    deleted = await deleteUserAccount(user.id);
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
