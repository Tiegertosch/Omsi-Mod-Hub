"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { PASSWORD_MAX } from "@/lib/auth-rules";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { qrPath, type QrPath } from "@/lib/qr";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { siteConfig } from "@/lib/site";
import { normalizeBackupCode, normalizeTotpCode, totpSecretFromUri } from "@/lib/two-factor";
import { mapAuthError } from "@/server/auth-errors";
import { twoFactorChangedEmail } from "@/server/emails";
import { sendMailInBackground } from "@/server/mail";
import { clientKey, consumeRateLimits, hashKey } from "@/server/rate-limit";
import { getCurrentUser, type CurrentUser } from "@/server/session";
import { twoFactorChallenge } from "@/server/two-factor-cookie";

/**
 * Zwei-Faktor-Anmeldung (Authenticator-App + Backup-Codes). Alle Wege laufen
 * über diese Actions; die HTTP-Endpunkte des Plugins sind gesperrt
 * (disabledPaths in src/lib/auth.ts). Eigene Limits, weil auth.api.* das
 * Rate-Limit von Better Auth umgeht und die Prüfung mit bestehender Session
 * (Einrichten, Abschalten) im Plugin keine Fehlversuche zählt.
 */

const MINUTE = 60 * 1000;
const localeSchema = z.enum(routing.locales).catch(routing.defaultLocale);
const passwordSchema = z.string().min(1).max(PASSWORD_MAX);

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const fail = (code: Extract<FormState, { status: "error" }>["code"]): FormState => ({ status: "error", code });
/** Falsches Format: Feldfehler am Code; ein falscher Code erscheint als Formularfehler. */
const badCode = (): FormState => ({ status: "error", code: "validation", fieldErrors: { code: "otp" } });

/** Wie `freshAge` von Better Auth (Standard 1 Tag): Abschalten nur mit frischer Session. */
const FRESH_SESSION_MS = 24 * 60 * MINUTE;

type CodeInput = { kind: "totp" | "backup"; code: string } | null;

function readCode(formData: FormData): CodeInput {
  const kind = text(formData, "method") === "backup" ? "backup" : "totp";
  const code = kind === "backup" ? normalizeBackupCode(text(formData, "code")) : normalizeTotpCode(text(formData, "code"));
  return code ? { kind, code } : null;
}

/** Prüft einen Code; ohne Session als Anmeldeschritt, mit Session als Bestätigung. */
async function verifyCode(input: NonNullable<CodeInput>) {
  const requestHeaders = await headers();
  return input.kind === "backup"
    ? auth.api.verifyBackupCode({ body: { code: input.code }, headers: requestHeaders })
    : auth.api.verifyTOTP({ body: { code: input.code }, headers: requestHeaders });
}

async function audit(user: CurrentUser, action: string) {
  await db.auditLog.create({ data: { actorId: user.id, action, entityType: "User", entityId: user.id } });
}

// ---------------------------------------------------------------------------
// Anmeldung, Schritt 2
// ---------------------------------------------------------------------------

export async function verifyTwoFactorLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeSchema.parse(text(formData, "locale"));
  const challenge = await twoFactorChallenge();
  if (!challenge) return fail("two_factor_expired");

  const input = readCode(formData);
  if (!input) return badCode();

  const allowed = await consumeRateLimits([
    { key: await clientKey("two-factor"), limit: 20, windowMs: 10 * MINUTE },
    { key: `two-factor:challenge:${hashKey(challenge)}`, limit: 10, windowMs: 10 * MINUTE },
  ]);
  if (!allowed) return fail("rate_limit");

  let preferredLocale: string | null | undefined;
  try {
    const result = await verifyCode(input);
    preferredLocale = (result.user as { preferredLocale?: string | null }).preferredLocale;
  } catch (error) {
    return fail(mapAuthError(error));
  }

  const homeLocale = preferredLocale && (routing.locales as readonly string[]).includes(preferredLocale) ? preferredLocale : locale;
  redirect(safeRedirectPath(text(formData, "next"), `/${homeLocale}/dashboard`));
}

// ---------------------------------------------------------------------------
// Einrichten
// ---------------------------------------------------------------------------

export type TwoFactorSetupState =
  | FormState
  | { status: "setup"; qr: QrPath; secret: string; uri: string; backupCodes: string[] };

/** Schritt 1: Passwort prüfen, Secret und Backup-Codes erzeugen (noch nicht aktiv). */
export async function startTwoFactorSetupAction(_prev: TwoFactorSetupState, formData: FormData): Promise<TwoFactorSetupState> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (user.twoFactorEnabled) return fail("two_factor_active");
  const password = passwordSchema.safeParse(text(formData, "password"));
  if (!password.success) return { status: "error", code: "validation", fieldErrors: { password: "required" } };
  if (!(await consumeRateLimits([{ key: `two-factor-setup:user:${user.id}`, limit: 5, windowMs: 15 * MINUTE }]))) {
    return fail("rate_limit");
  }

  try {
    const result = await auth.api.enableTwoFactor({
      body: { password: password.data, method: "totp", issuer: siteConfig.name },
      headers: await headers(),
    });
    if (result.method !== "totp" || !result.totpURI || !result.backupCodes) return fail("generic");
    const secret = totpSecretFromUri(result.totpURI);
    if (!secret) return fail("generic");
    return { status: "setup", qr: qrPath(result.totpURI), secret, uri: result.totpURI, backupCodes: result.backupCodes };
  } catch (error) {
    const code = mapAuthError(error);
    return fail(code);
  }
}

/** Schritt 2: ersten Code aus der App prüfen; erst dann ist 2FA aktiv. */
export async function confirmTwoFactorSetupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (user.twoFactorEnabled) return fail("two_factor_active");
  const code = normalizeTotpCode(text(formData, "code"));
  if (!code) return badCode();
  if (!(await consumeRateLimits([{ key: `two-factor-confirm:user:${user.id}`, limit: 10, windowMs: 15 * MINUTE }]))) {
    return fail("rate_limit");
  }

  const started = new Date();
  try {
    // Aktiviert 2FA und ersetzt die aktuelle Session durch eine neue.
    await auth.api.verifyTOTP({ body: { code }, headers: await headers() });
  } catch (error) {
    return fail(mapAuthError(error));
  }

  // Alle anderen Geräte abmelden: Wer dort mit gestohlenem Passwort angemeldet
  // war, bleibt sonst angemeldet. Die neue Session ist jünger als `started`.
  await db.session.deleteMany({ where: { userId: user.id, createdAt: { lt: started } } });
  await audit(user, "user.two_factor_enable");
  sendMailInBackground(twoFactorChangedEmail(user, "enabled"));
  refresh();
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Backup-Codes erneuern, Abschalten
// ---------------------------------------------------------------------------

export type BackupCodesState = FormState | { status: "codes"; backupCodes: string[] };

/** Neue Backup-Codes; die alten werden ungültig. */
export async function regenerateBackupCodesAction(_prev: BackupCodesState, formData: FormData): Promise<BackupCodesState> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!user.twoFactorEnabled) return fail("generic");
  const password = passwordSchema.safeParse(text(formData, "password"));
  if (!password.success) return { status: "error", code: "validation", fieldErrors: { password: "required" } };
  if (!(await consumeRateLimits([{ key: `two-factor-codes:user:${user.id}`, limit: 5, windowMs: 15 * MINUTE }]))) {
    return fail("rate_limit");
  }

  try {
    const result = await auth.api.generateBackupCodes({ body: { password: password.data }, headers: await headers() });
    await audit(user, "user.two_factor_backup_codes");
    refresh();
    return { status: "codes", backupCodes: result.backupCodes };
  } catch (error) {
    const code = mapAuthError(error);
    return fail(code);
  }
}

/** Abschalten nur mit Passwort und einem gültigen Code (App oder Backup-Code). */
export async function disableTwoFactorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!user.twoFactorEnabled) return fail("generic");
  const password = passwordSchema.safeParse(text(formData, "password"));
  const input = readCode(formData);
  if (!password.success || !input) {
    return {
      status: "error",
      code: "validation",
      fieldErrors: { ...(password.success ? {} : { password: "required" }), ...(input ? {} : { code: "otp" }) },
    };
  }
  if (!(await consumeRateLimits([{ key: `two-factor-disable:user:${user.id}`, limit: 5, windowMs: 15 * MINUTE }]))) {
    return fail("rate_limit");
  }
  // Vorab prüfen, was disableTwoFactor am Ende verlangt – sonst wäre ein
  // Backup-Code verbraucht, obwohl das Abschalten scheitert.
  const session = await db.session.findUnique({ where: { id: user.sessionId }, select: { createdAt: true } });
  if (!session || Date.now() - session.createdAt.getTime() >= FRESH_SESSION_MS) return fail("session_not_fresh");

  const requestHeaders = await headers();
  try {
    // Passwort zuerst: Sonst wäre ein Backup-Code bei falschem Passwort verbraucht.
    await auth.api.verifyPassword({ body: { password: password.data }, headers: requestHeaders });
  } catch (error) {
    const code = mapAuthError(error);
    return fail(code === "invalid_credentials" ? "current_password_wrong" : code);
  }
  try {
    await verifyCode(input);
  } catch (error) {
    return fail(mapAuthError(error));
  }
  try {
    // Verlangt eine frische Session (höchstens 1 Tag alt), sonst SESSION_NOT_FRESH.
    await auth.api.disableTwoFactor({ body: { password: password.data }, headers: requestHeaders });
  } catch (error) {
    return fail(mapAuthError(error));
  }

  await audit(user, "user.two_factor_disable");
  sendMailInBackground(twoFactorChangedEmail(user, "disabled"));
  refresh();
  return { status: "success" };
}
