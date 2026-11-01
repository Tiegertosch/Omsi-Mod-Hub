import "server-only";

import { createTranslator, hasLocale } from "next-intl";

import { routing, type AppLocale } from "@/i18n/routing";
import type { AdminProjectAction } from "@/lib/moderation";
import { siteConfig } from "@/lib/site";
import de from "../../messages/de.json";
import en from "../../messages/en.json";

import { appealPath } from "./appeals";
import type { MailMessage } from "./mail";

const MESSAGES = { de, en } as const;

type MailUser = { email: string; name: string; preferredLocale?: unknown };

function mailLocale(user: MailUser): AppLocale {
  return hasLocale(routing.locales, user.preferredLocale) ? user.preferredLocale : routing.defaultLocale;
}

function translator(locale: AppLocale) {
  // Feste Zeitzone wie in src/i18n/request.ts, damit Daten (Fristen) überall gleich erscheinen.
  return createTranslator({ locale, messages: MESSAGES[locale], namespace: "Email", timeZone: "Europe/Berlin" });
}

/** Absolute URLs in E-Mails zeigen auf dieselbe Basis wie die Links von Better Auth. */
function absoluteUrl(path: string): string {
  return `${(process.env.BETTER_AUTH_URL ?? siteConfig.url).replace(/\/+$/, "")}${path}`;
}

/** 6-stelliger Code zur Bestätigung der Adresse nach der Registrierung. */
export function verificationCodeEmail(user: MailUser, code: string, minutes: number): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  return {
    to: user.email,
    subject: t("verifyCodeSubject", { code }),
    text: t("verifyCodeBody", { name: user.name, code, minutes, url: absoluteUrl(`/${locale}/confirm-email`) }),
  };
}

/**
 * Registrierung mit einer schon vergebenen Adresse: Statt eines Codes erfährt
 * der Inhaber, dass er bereits ein Konto hat (siehe src/server/existing-account.ts).
 */
export function accountExistsEmail(user: MailUser & { username: string; emailVerified: boolean }): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  return {
    to: user.email,
    subject: t("accountExistsSubject"),
    text: t("accountExistsBody", {
      name: user.name,
      username: user.username,
      status: user.emailVerified ? "verified" : "unverified",
      loginUrl: absoluteUrl(`/${locale}/login`),
      resetUrl: absoluteUrl(`/${locale}/forgot-password`),
    }),
  };
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
 * Freitext der Moderation und wird nur als Klartext verschickt. Bei
 * widersprechbaren Entscheidungen (Ausblenden, Zurückweisen) enthält sie den
 * Widerspruchslink samt Frist.
 */
export function projectDecisionEmail(
  user: MailUser,
  project: { id: string; slug: string; title: string },
  action: AdminProjectAction,
  note: string | null,
  appeal?: { token: string; until: Date },
): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  const publicAction = action === "approve" || action === "unhide";
  const url = absoluteUrl(
    publicAction ? `/${locale}/mods/${project.slug}` : `/${locale}/dashboard/projects/${project.id}/edit`,
  );
  const values = { name: user.name, title: project.title, url, note: note ?? "" };
  const appealText = appeal
    ? `\n\n${t("appealHint", { appealUntil: appeal.until, appealUrl: absoluteUrl(appealPath(locale, appeal.token)) })}`
    : "";
  return {
    to: user.email,
    subject: t(`decision.${action}.subject`, { title: project.title }),
    text: t(`decision.${action}.body`, values) + appealText,
  };
}

/** Ein Downloadlink wurde gesperrt oder als defekt markiert. */
export function linkStatusEmail(
  user: MailUser,
  project: { id: string; title: string },
  link: { url: string; version: string },
  status: "BLOCKED" | "BROKEN",
  note: string | null,
): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  const key = status === "BLOCKED" ? "blocked" : "broken";
  return {
    to: user.email,
    subject: t(`link.${key}.subject`, { title: project.title }),
    text: t(`link.${key}.body`, {
      name: user.name,
      title: project.title,
      version: link.version,
      url: link.url,
      note: note ?? "",
      hasNote: note ? "yes" : "no",
      editUrl: absoluteUrl(`/${locale}/dashboard/projects/${project.id}/edit#versions`),
    }),
  };
}

/** Sperre eines Kontos mit Begründung und Dauer. */
export function banEmail(user: MailUser, ban: { reason: string; expires: Date | null; hiddenProjects: number }): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  return {
    to: user.email,
    subject: t("ban.subject"),
    text: t("ban.body", {
      name: user.name,
      reason: ban.reason,
      duration: ban.expires ? t("ban.until", { until: ban.expires }) : t("ban.permanent"),
      hidden: ban.hiddenProjects,
      contactUrl: absoluteUrl(`/${locale}/legal/imprint`),
    }),
  };
}

/** Ergebnis eines Widerspruchs mit der Begründung der Moderation. */
export function appealResultEmail(
  user: MailUser,
  project: { id: string; slug: string; title: string },
  result: { granted: boolean; restored: boolean; note: string },
): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  const url = absoluteUrl(
    result.restored ? `/${locale}/mods/${project.slug}` : `/${locale}/dashboard/projects/${project.id}/edit`,
  );
  const key = result.granted ? "granted" : "denied";
  return {
    to: user.email,
    subject: t(`appealResult.${key}.subject`, { title: project.title }),
    text: t(`appealResult.${key}.body`, {
      name: user.name,
      title: project.title,
      note: result.note,
      url,
      restored: result.restored ? "yes" : "no",
    }),
  };
}
