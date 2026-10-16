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
