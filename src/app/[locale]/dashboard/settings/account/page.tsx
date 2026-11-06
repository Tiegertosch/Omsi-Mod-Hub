import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { DeleteAccountForm } from "@/components/account/account-security";
import { NotificationSettingsForm } from "@/components/account/notification-settings";
import { EmailForm } from "@/components/account/settings-forms";
import { SettingsSection } from "@/components/account/settings-section";
import { FormSkeleton } from "@/components/auth/auth-shell";
import { FormAlert } from "@/components/ui/form";
import { canDeleteOwnAccount } from "@/lib/account";
import { FAVORITE_LIMIT } from "@/lib/favorites";
import { getDeletionSummary } from "@/server/data/account";
import { getProjectUpdateSetting } from "@/server/data/favorites";
import { requireUser } from "@/server/session";

type Props = PageProps<"/[locale]/dashboard/settings/account">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: `${t("settingsNav.account")} – ${t("settingsTitle")}`, robots: { index: false, follow: false } };
}

/** Einstellungen → Konto: E-Mail-Adresse, Benachrichtigungen und Konto löschen (Gefahrenbereich). */
async function AccountContent({ searchParams }: Pick<Props, "searchParams">) {
  const locale = await rootLocale();
  const user = await requireUser(locale, `/${locale}/dashboard/settings/account`);
  const [{ emailChange, error }, t, favoritesT, deletion, notifyProjectUpdates] = await Promise.all([
    searchParams,
    getTranslations("Account"),
    getTranslations("Favorites"),
    getDeletionSummary(user.id),
    getProjectUpdateSetting(user.id),
  ]);
  // Ziel der Bestätigungslinks; Better Auth hängt bei Fehlern ?error=… an.
  const emailChangeNotice = emailChange === "1" ? (typeof error === "string" && error ? "error" : "confirmed") : null;

  return (
    <div className="space-y-6">
      <SettingsSection id="email" title={t("emailSection")}>
        {emailChangeNotice ? (
          <div className="mb-5">
            <FormAlert tone={emailChangeNotice === "error" ? "error" : "success"}>
              {emailChangeNotice === "error" ? t("emailChangeFailed") : t("emailChangeConfirmed")}
            </FormAlert>
          </div>
        ) : null}
        <EmailForm email={user.email} />
      </SettingsSection>

      <SettingsSection id="notifications" title={favoritesT("settingsTitle")} description={favoritesT("settingsDescription")}>
        <NotificationSettingsForm
          enabled={notifyProjectUpdates}
          labels={{
            label: favoritesT("settingsLabel"),
            save: favoritesT("settingsSave"),
            saving: favoritesT("settingsSaving"),
            saved: favoritesT("settingsSaved"),
            errors: {
              unauthorized: favoritesT("errors.unauthorized"),
              rate_limit: favoritesT("errors.rate_limit"),
              not_found: favoritesT("errors.not_found"),
              limit: favoritesT("errors.limit", { max: FAVORITE_LIMIT }),
              invalid_link: favoritesT("errors.invalid_link"),
              generic: favoritesT("errors.generic"),
            },
          }}
        />
      </SettingsSection>

      <SettingsSection id="delete" title={t("deleteSection")} description={t("deleteText")} danger>
        <div className="space-y-4">
          <p className="text-sm text-muted">{t("deleteWhat")}</p>
          <p className="text-sm text-fg">
            {t("deleteProjectCount", { count: deletion.projects, published: deletion.published })}
          </p>
          {canDeleteOwnAccount(user.role) ? (
            <DeleteAccountForm username={user.username} />
          ) : (
            <p className="rounded-lg border border-border bg-surface-2 px-3.5 py-3 text-sm text-muted">
              {t("deleteAdminBlocked")}
            </p>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}

export default function AccountSettingsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<FormSkeleton fields={3} />}>
      <AccountContent searchParams={searchParams} />
    </Suspense>
  );
}
