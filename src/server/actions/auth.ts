"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { PASSWORD_MAX, PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN, USERNAME_PATTERN } from "@/lib/auth-rules";
import { fieldErrorsFrom, type FormState } from "@/lib/form-state";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { mapAuthError } from "@/server/auth-errors";
import { clientKey, consumeRateLimits, hashKey } from "@/server/rate-limit";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const localeSchema = z.enum(routing.locales).catch(routing.defaultLocale);
const emailSchema = z.string().trim().toLowerCase().pipe(z.email({ message: "email" }).max(254, { message: "email" }));
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, { message: "password" })
  .max(PASSWORD_MAX, { message: "password" });

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

// ---------------------------------------------------------------------------
// Registrierung
// ---------------------------------------------------------------------------

const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(USERNAME_MIN, { message: "username" })
      .max(USERNAME_MAX, { message: "username" })
      .regex(USERNAME_PATTERN, { message: "username" }),
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    acceptTerms: z.literal("on", { message: "acceptTerms" }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "passwordConfirm",
  });

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeSchema.parse(text(formData, "locale"));
  const values = { username: text(formData, "username"), email: text(formData, "email") };

  // Honeypot: Bots erhalten eine scheinbare Erfolgsmeldung.
  if (text(formData, "website")) return { status: "success", message: values.email };

  const parsed = registerSchema.safeParse({
    username: values.username,
    email: values.email,
    password: text(formData, "password"),
    passwordConfirm: text(formData, "passwordConfirm"),
    acceptTerms: formData.get("acceptTerms") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", code: "validation", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const allowed = await consumeRateLimits([{ key: await clientKey("register"), limit: 5, windowMs: HOUR }]);
  if (!allowed) return { status: "error", code: "rate_limit", values };

  try {
    const username = parsed.data.username.toLowerCase();
    await auth.api.signUpEmail({
      body: {
        name: username,
        username,
        email: parsed.data.email,
        password: parsed.data.password,
        preferredLocale: locale,
        callbackURL: `/${locale}/verify-email`,
      },
      headers: await headers(),
    });
  } catch (error) {
    const code = mapAuthError(error);
    return {
      status: "error",
      code,
      values,
      fieldErrors: code === "username_taken" ? { username: "username" } : undefined,
    };
  }

  // Auch bei bereits registrierter E-Mail gleiche Antwort (Schutz vor Ausspähen).
  return { status: "success", message: parsed.data.email };
}

// ---------------------------------------------------------------------------
// Anmeldung
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  identifier: z.string().trim().min(1, { message: "required" }).max(254, { message: "required" }),
  password: z.string().min(1, { message: "required" }).max(PASSWORD_MAX, { message: "password" }),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeSchema.parse(text(formData, "locale"));
  const values = { identifier: text(formData, "identifier") };

  const parsed = loginSchema.safeParse({ identifier: values.identifier, password: text(formData, "password") });
  if (!parsed.success) {
    return { status: "error", code: "validation", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const identifier = parsed.data.identifier.toLowerCase();
  const allowed = await consumeRateLimits([
    { key: await clientKey("login"), limit: 20, windowMs: 10 * MINUTE },
    { key: `login:id:${hashKey(identifier)}`, limit: 10, windowMs: 15 * MINUTE },
  ]);
  if (!allowed) return { status: "error", code: "rate_limit", values };

  let preferredLocale: string | null | undefined;
  try {
    const requestHeaders = await headers();
    const result = identifier.includes("@")
      ? await auth.api.signInEmail({
          body: { email: identifier, password: parsed.data.password, callbackURL: `/${locale}/verify-email` },
          headers: requestHeaders,
        })
      : await auth.api.signInUsername({
          body: { username: identifier, password: parsed.data.password },
          headers: requestHeaders,
        });
    preferredLocale = (result.user as { preferredLocale?: string | null }).preferredLocale;
  } catch (error) {
    return { status: "error", code: mapAuthError(error), values };
  }

  const homeLocale = preferredLocale && (routing.locales as readonly string[]).includes(preferredLocale) ? preferredLocale : locale;
  redirect(safeRedirectPath(text(formData, "next"), `/${homeLocale}/dashboard`));
}

// ---------------------------------------------------------------------------
// Abmeldung
// ---------------------------------------------------------------------------

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(text(formData, "locale"));
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    // Auch ohne gültige Session zur Startseite zurückkehren.
    mapAuthError(error);
  }
  redirect(`/${locale}`);
}

// ---------------------------------------------------------------------------
// Passwort vergessen / zurücksetzen
// ---------------------------------------------------------------------------

export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeSchema.parse(text(formData, "locale"));
  const values = { email: text(formData, "email") };

  const parsed = z.object({ email: emailSchema }).safeParse(values);
  if (!parsed.success) {
    return { status: "error", code: "validation", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const allowed = await consumeRateLimits([
    { key: await clientKey("reset"), limit: 5, windowMs: HOUR },
    { key: `reset:id:${hashKey(parsed.data.email)}`, limit: 3, windowMs: HOUR },
  ]);
  if (!allowed) return { status: "error", code: "rate_limit", values };

  try {
    await auth.api.requestPasswordReset({
      body: { email: parsed.data.email, redirectTo: `/${locale}/reset-password` },
      headers: await headers(),
    });
  } catch (error) {
    // Fehler nicht offenlegen – die Antwort ist immer gleich.
    mapAuthError(error);
  }
  return { status: "success" };
}

const resetSchema = z
  .object({
    token: z.string().min(1, { message: "required" }).max(512, { message: "required" }),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "passwordConfirm",
  });

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({
    token: text(formData, "token"),
    password: text(formData, "password"),
    passwordConfirm: text(formData, "passwordConfirm"),
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error);
    return { status: "error", code: fieldErrors.token ? "token_invalid" : "validation", fieldErrors };
  }

  if (!(await consumeRateLimits([{ key: await clientKey("reset-password"), limit: 10, windowMs: HOUR }]))) {
    return { status: "error", code: "rate_limit" };
  }

  try {
    await auth.api.resetPassword({
      body: { token: parsed.data.token, newPassword: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    return { status: "error", code: mapAuthError(error) };
  }
  return { status: "success" };
}
