import "server-only";

import { createTranslator, hasLocale } from "next-intl";

import { routing, type AppLocale } from "@/i18n/routing";
import type { AdminProjectAction } from "@/lib/moderation";
import { siteConfig } from "@/lib/site";
import de from "../../messages/de.json";
import en from "../../messages/en.json";

import type { MailMessage } from "./mail";

const MESSAGES = { de, en } as const;

type MailUser = { email: string; name: string; preferredLocale?: unknown };

function mailLocale(user: MailUser): AppLocale {
  return hasLocale(routing.locales, user.preferredLocale) ? user.preferredLocale : routing.defaultLocale;
}

function translator(locale: AppLocale) {
  return createTranslator({ locale, messages: MESSAGES[locale], namespace: "Email" });
}

/** Absolute URLs in E-Mails zeigen auf dieselbe Basis wie die Links von Better Auth. */
function absoluteUrl(path: string): string {
  return `${(process.env.BETTER_AUTH_URL ?? siteConfig.url).replace(/\/+$/, "")}${path}`;
}

export function verificationEmail(user: MailUser, url: string): MailMessage {
  const t = translator(mailLocale(user));
  return { to: user.email, subject: t("verifySubject"), text: t("verifyBody", { name: user.name, url }) };
}

/** Schritt 1 der E-Mail-Änderung: Bestätigung über die bisherige Adresse. */
export function changeEmailConfirmationEmail(user: MailUser, newEmail: string, url: string): MailMessage {
  const t = translator(mailLocale(user));
  return {
    to: user.email,
    subject: t("changeEmailConfirmSubject"),
    text: t("changeEmailConfirmBody", { name: user.name, newEmail, url }),
  };
}

/** Schritt 2: Bestätigung der neuen Adresse (`user.email` ist hier schon die neue). */
export function changeEmailVerificationEmail(user: MailUser, url: string): MailMessage {
  const t = translator(mailLocale(user));
  return { to: user.email, subject: t("changeEmailVerifySubject"), text: t("changeEmailVerifyBody", { name: user.name, url }) };
}

export function accountDeletedEmail(user: MailUser): MailMessage {
  const t = translator(mailLocale(user));
  return { to: user.email, subject: t("accountDeletedSubject"), text: t("accountDeletedBody", { name: user.name }) };
}

export function resetPasswordEmail(user: MailUser, url: string): MailMessage {
  const t = translator(mailLocale(user));
  return { to: user.email, subject: t("resetSubject"), text: t("resetBody", { name: user.name, url }) };
}

/**
 * Benachrichtigung über eine Moderationsentscheidung. Die Begründung ist
 * Freitext der Moderation und wird nur als Klartext verschickt.
 */
export function projectDecisionEmail(
  user: MailUser,
  project: { id: string; slug: string; title: string },
  action: AdminProjectAction,
  note: string | null,
): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  const publicAction = action === "approve" || action === "unhide";
  const url = absoluteUrl(
    publicAction ? `/${locale}/mods/${project.slug}` : `/${locale}/dashboard/projects/${project.id}/edit`,
  );
  const values = { name: user.name, title: project.title, url, note: note ?? "" };
  return {
    to: user.email,
    subject: t(`decision.${action}.subject`, { title: project.title }),
    text: t(`decision.${action}.body`, values),
  };
}
