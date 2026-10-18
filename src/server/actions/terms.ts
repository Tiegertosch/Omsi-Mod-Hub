"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { PASSWORD_MAX } from "@/lib/auth-rules";
import { db } from "@/lib/db";
import { fieldErrorsFrom, type FormState } from "@/lib/form-state";
import { TERMS_VERSION } from "@/lib/legal";
import { deleteOwnAccount } from "@/server/own-account-deletion";
import { consumeRateLimits } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/session";

const localeSchema = z.enum(routing.locales).catch(routing.defaultLocale);
const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/**
 * Popup „Neue Nutzungsbedingungen“, Button 1: Zustimmung zur neuesten Fassung
 * speichern. Die Fassung kommt vom Server (TERMS_VERSION), nie aus dem Formular.
 */
export async function acceptTermsAction(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", code: "unauthorized" };
  if (!(await consumeRateLimits([{ key: `terms:user:${user.id}`, limit: 20, windowMs: 10 * 60 * 1000 }]))) {
    return { status: "error", code: "rate_limit" };
  }
  await db.user.update({
    where: { id: user.id },
    data: { termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() },
  });
  refresh();
  return { status: "success" };
}

const declineSchema = z.object({
  password: z.string().min(1, { message: "required" }).max(PASSWORD_MAX, { message: "password" }),
});

/**
 * Button 2: Änderungen ablehnen und Konto schließen. Wie das Löschen in den
 * Einstellungen mit Passwort bestätigt – eine übernommene Sitzung allein
 * genügt nicht, um ein Konto zu löschen.
 */
export async function declineTermsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", code: "unauthorized" };
  const parsed = declineSchema.safeParse({ password: text(formData, "password") });
  if (!parsed.success) return { status: "error", code: "validation", fieldErrors: fieldErrorsFrom(parsed.error) };
  return deleteOwnAccount({
    user,
    password: parsed.data.password,
    locale: localeSchema.parse(text(formData, "locale")),
    reason: "terms_declined",
  });
}
