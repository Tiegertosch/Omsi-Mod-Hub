import { getTranslations } from "next-intl/server";

import { SettingsNav } from "@/components/account/settings-nav";

/**
 * Rahmen der Einstellungen mit Reitern. Wie das Dashboard-Layout ohne
 * Session-Zugriff; jede Unterseite prüft die Anmeldung selbst.
 */
export default async function SettingsLayout({ children }: LayoutProps<"/[locale]/dashboard/settings">) {
  const t = await getTranslations("Account");
  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-fg">{t("settingsTitle")}</h1>
      <SettingsNav
        label={t("settingsNav.label")}
        items={[
          { href: "/dashboard/settings", label: t("settingsNav.profile") },
          { href: "/dashboard/settings/security", label: t("settingsNav.security") },
          { href: "/dashboard/settings/account", label: t("settingsNav.account") },
        ]}
      />
      {children}
    </div>
  );
}
