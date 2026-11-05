import { Monitor, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { RevokeOtherSessionsForm, RevokeSessionForm } from "@/components/account/account-security";
import { PasswordForm } from "@/components/account/settings-forms";
import { SettingsSection } from "@/components/account/settings-section";
import { TwoFactorSettings } from "@/components/account/two-factor-settings";
import { FormSkeleton } from "@/components/auth/auth-shell";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getOwnSessions } from "@/server/data/account";
import { requireUser } from "@/server/session";

type Props = PageProps<"/[locale]/dashboard/settings/security">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: `${t("settingsNav.security")} – ${t("settingsTitle")}`, robots: { index: false, follow: false } };
}

const MOBILE_SYSTEMS = new Set(["iOS", "Android"]);

/** Anzahl der noch unbenutzten Backup-Codes (die Codes selbst werden nie angezeigt). */
async function backupCodesLeft(userId: string, enabled: boolean): Promise<number> {
  if (!enabled) return 0;
  try {
    const { backupCodes } = await auth.api.viewBackupCodes({ body: { userId } });
    return backupCodes.length;
  } catch {
    return 0;
  }
}

/** Einstellungen → Sicherheit: Passwort, Zwei-Faktor-Anmeldung, angemeldete Geräte. */
async function SecurityContent({ searchParams }: Pick<Props, "searchParams">) {
  const locale = await rootLocale();
  const user = await requireUser(locale, `/${locale}/dashboard/settings/security`);
  const [{ twoFactor }, t, format, sessions, codesLeft] = await Promise.all([
    searchParams,
    getTranslations("Account"),
    getFormatter(),
    getOwnSessions(user),
    backupCodesLeft(user.id, user.twoFactorEnabled),
  ]);
  const admin = isAdmin(user.role);
  // Admins ohne 2FA werden von requireAdmin hierher geleitet.
  const twoFactorRequired = admin && !user.twoFactorEnabled;

  return (
    <div className="space-y-6">
      <SettingsSection id="password" title={t("passwordSection")}>
        <PasswordForm />
      </SettingsSection>

      <SettingsSection id="two-factor" title={t("twoFactor.section")} description={t("twoFactor.text")}>
        {twoFactorRequired ? (
          <p className="mb-5 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
            {twoFactor === "required" ? t("twoFactor.requiredRedirect") : t("twoFactor.requiredAdmin")}
          </p>
        ) : null}
        <TwoFactorSettings enabled={user.twoFactorEnabled} backupCodesLeft={codesLeft} isAdmin={admin} />
      </SettingsSection>

      <SettingsSection id="sessions" title={t("sessionsSection")} description={t("sessionsText")}>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {sessions.map((session) => {
            const { browser, os } = session.device;
            const label = browser && os ? t("deviceOn", { browser, os }) : (browser ?? os ?? t("unknownDevice"));
            const Icon = os && MOBILE_SYSTEMS.has(os) ? Smartphone : Monitor;
            return (
              <li key={session.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="flex min-w-0 gap-3">
                  <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-subtle" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                      {label}
                      {session.current ? <Badge tone="accent">{t("thisDevice")}</Badge> : null}
                    </p>
                    <p className="mt-1 text-xs text-subtle">
                      {t("signedInAt", { date: format.dateTime(session.createdAt, { dateStyle: "medium" }) })}
                      {" · "}
                      {t("lastActive", { date: format.dateTime(session.lastActiveAt, { dateStyle: "medium" }) })}
                      {session.ipAddress ? (
                        <>
                          {" · "}
                          {t("ipAddress", { ip: session.ipAddress })}
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
                {session.current ? null : <RevokeSessionForm sessionId={session.id} label={label} />}
              </li>
            );
          })}
        </ul>
        {sessions.length > 1 ? (
          <div className="mt-5">
            <RevokeOtherSessionsForm />
          </div>
        ) : null}
      </SettingsSection>
    </div>
  );
}

export default function SecuritySettingsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<FormSkeleton fields={4} />}>
      <SecurityContent searchParams={searchParams} />
    </Suspense>
  );
}
