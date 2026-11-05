import "server-only";

import { createTranslator, hasLocale } from "next-intl";

import { routing, type AppLocale } from "@/i18n/routing";
import { renderEmailHtml, type EmailLayout } from "@/lib/email-html";
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

type LayoutExtras = Pick<EmailLayout, "cta" | "secondary" | "highlight" | "code" | "plain">;

/**
 * Klartext plus HTML-Fassung im Design der Website (src/lib/email-html.ts).
 * Der Klartext bleibt maßgeblich; das HTML wird daraus erzeugt.
 */
function compose(locale: AppLocale, to: string, subject: string, text: string, extras: LayoutExtras = {}): MailMessage {
  const t = translator(locale);
  return {
    to,
    subject,
    text,
    html: renderEmailHtml({
      locale,
      subject,
      text,
      ...extras,
      labels: {
        fallback: t("layout.fallback"),
        footer: t("layout.footer"),
        imprint: t("layout.imprint"),
        privacy: t("layout.privacy"),
      },
      links: { imprint: absoluteUrl(`/${locale}/legal/imprint`), privacy: absoluteUrl(`/${locale}/legal/privacy`) },
    }),
  };
}

/** 6-stelliger Code zur Bestätigung der Adresse nach der Registrierung. */
export function verificationCodeEmail(user: MailUser, code: string, minutes: number): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  const url = absoluteUrl(`/${locale}/confirm-email`);
  return compose(locale, user.email, t("verifyCodeSubject", { code }), t("verifyCodeBody", { name: user.name, code, minutes, url }), {
    code,
    cta: { url, label: t("cta.enterCode") },
  });
}

/**
 * Registrierung mit einer schon vergebenen Adresse: Statt eines Codes erfährt
 * der Inhaber, dass er bereits ein Konto hat (siehe src/server/existing-account.ts).
 */
export function accountExistsEmail(user: MailUser & { username: string; emailVerified: boolean }): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  const loginUrl = absoluteUrl(`/${locale}/login`);
  const resetUrl = absoluteUrl(`/${locale}/forgot-password`);
  const text = t("accountExistsBody", {
    name: user.name,
    username: user.username,
    status: user.emailVerified ? "verified" : "unverified",
    loginUrl,
    resetUrl,
  });
  return compose(locale, user.email, t("accountExistsSubject"), text, {
    cta: { url: loginUrl, label: t("cta.login") },
    secondary: { url: resetUrl, label: t("cta.resetPassword") },
  });
}

/** Schritt 1 der E-Mail-Änderung: Bestätigung über die bisherige Adresse. */
export function changeEmailConfirmationEmail(user: MailUser, newEmail: string, url: string): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  return compose(locale, user.email, t("changeEmailConfirmSubject"), t("changeEmailConfirmBody", { name: user.name, newEmail, url }), {
    cta: { url, label: t("cta.confirmChange") },
  });
}

/** Schritt 2: Bestätigung der neuen Adresse (`user.email` ist hier schon die neue). */
export function changeEmailVerificationEmail(user: MailUser, url: string): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  return compose(locale, user.email, t("changeEmailVerifySubject"), t("changeEmailVerifyBody", { name: user.name, url }), {
    cta: { url, label: t("cta.confirmAddress") },
  });
}

/**
 * Code zum Löschen eines Projekts. Wer ihn angefordert hat, hatte Zugriff auf
 * die Sitzung; die Mail rät deshalb zum Passwortwechsel, falls es jemand
 * anderes war.
 */
export function projectDeletionCodeEmail(
  user: MailUser,
  project: { id: string; title: string },
  code: string,
  minutes: number,
): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  const url = absoluteUrl(`/${locale}/dashboard/projects/${project.id}/edit#delete-project`);
  const text = t("projectDeleteBody", { name: user.name, title: project.title, code, minutes, url });
  return compose(locale, user.email, t("projectDeleteSubject", { code, title: project.title }), text, {
    code,
    cta: { url, label: t("cta.enterCode") },
  });
}

export function accountDeletedEmail(user: MailUser): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  return compose(locale, user.email, t("accountDeletedSubject"), t("accountDeletedBody", { name: user.name }));
}

export function resetPasswordEmail(user: MailUser, url: string): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  return compose(locale, user.email, t("resetSubject"), t("resetBody", { name: user.name, url }), {
    cta: { url, label: t("cta.setPassword") },
  });
}

/**
 * Benachrichtigung über eine Moderationsentscheidung. Die Begründung ist
 * Freitext der Moderation; im HTML erscheint sie escaped als Kasten. Bei
 * widersprechbaren Entscheidungen (Ausblenden, Zurückweisen) enthält die Mail
 * den Widerspruchslink samt Frist.
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
  const appealUrl = appeal ? absoluteUrl(appealPath(locale, appeal.token)) : null;
  const appealText = appeal && appealUrl ? `\n\n${t("appealHint", { appealUntil: appeal.until, appealUrl })}` : "";
  return compose(
    locale,
    user.email,
    t(`decision.${action}.subject`, { title: project.title }),
    t(`decision.${action}.body`, values) + appealText,
    {
      cta: { url, label: t(publicAction ? "cta.viewProject" : "cta.openDashboard") },
      secondary: appealUrl ? { url: appealUrl, label: t("cta.appeal") } : undefined,
      highlight: [note],
    },
  );
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
  const editUrl = absoluteUrl(`/${locale}/dashboard/projects/${project.id}/edit#versions`);
  const text = t(`link.${key}.body`, {
    name: user.name,
    title: project.title,
    version: link.version,
    url: link.url,
    note: note ?? "",
    hasNote: note ? "yes" : "no",
    editUrl,
  });
  return compose(locale, user.email, t(`link.${key}.subject`, { title: project.title }), text, {
    cta: { url: editUrl, label: t("cta.openEditor") },
    highlight: [note],
    // Den betroffenen (womöglich schädlichen) Link nicht anklickbar machen.
    plain: [link.url],
  });
}

/** Sperre eines Kontos mit Begründung und Dauer. */
export function banEmail(user: MailUser, ban: { reason: string; expires: Date | null; hiddenProjects: number }): MailMessage {
  const locale = mailLocale(user);
  const t = translator(locale);
  const contactUrl = absoluteUrl(`/${locale}/legal/imprint`);
  const text = t("ban.body", {
    name: user.name,
    reason: ban.reason,
    duration: ban.expires ? t("ban.until", { until: ban.expires }) : t("ban.permanent"),
    hidden: ban.hiddenProjects,
    contactUrl,
  });
  return compose(locale, user.email, t("ban.subject"), text, {
    secondary: { url: contactUrl, label: t("cta.contact") },
    highlight: [ban.reason],
  });
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
  const text = t(`appealResult.${key}.body`, {
    name: user.name,
    title: project.title,
    note: result.note,
    url,
    restored: result.restored ? "yes" : "no",
  });
  return compose(locale, user.email, t(`appealResult.${key}.subject`, { title: project.title }), text, {
    cta: { url, label: t(result.restored ? "cta.viewProject" : "cta.openDashboard") },
    highlight: [result.note],
  });
}
