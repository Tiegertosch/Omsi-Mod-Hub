import "server-only";

import { createTranslator, hasLocale } from "next-intl";

import { routing, type AppLocale } from "@/i18n/routing";
import de from "../../messages/de.json";
import en from "../../messages/en.json";

import type { MailMessage } from "./mail";

const MESSAGES = { de, en } as const;

type MailUser = { email: string; name: string; preferredLocale?: unknown };

function translator(user: MailUser) {
  const locale: AppLocale = hasLocale(routing.locales, user.preferredLocale) ? user.preferredLocale : routing.defaultLocale;
  return createTranslator({ locale, messages: MESSAGES[locale], namespace: "Email" });
}

export function verificationEmail(user: MailUser, url: string): MailMessage {
  const t = translator(user);
  return { to: user.email, subject: t("verifySubject"), text: t("verifyBody", { name: user.name, url }) };
}

export function resetPasswordEmail(user: MailUser, url: string): MailMessage {
  const t = translator(user);
  return { to: user.email, subject: t("resetSubject"), text: t("resetBody", { name: user.name, url }) };
}
