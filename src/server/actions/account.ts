"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { DISPLAY_NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth-rules";
import { fieldErrorsFrom, type FormState } from "@/lib/form-state";
import { mapAuthError } from "@/server/auth-errors";
import { consumeRateLimits } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/session";

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
