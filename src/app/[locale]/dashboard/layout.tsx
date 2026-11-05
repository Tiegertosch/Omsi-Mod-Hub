import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Container } from "@/components/ui/container";
import { SideNav, SideNavFallback } from "@/components/ui/side-nav";
import { getClientMessages } from "@/i18n/client-messages";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Bewusst ohne Session-Prüfung: Layouts werden bei Navigationen nicht neu
 * gerendert. Jede Seite und jede Action prüft die Anmeldung selbst.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/[locale]/dashboard">) {
  const [t, projects, messages] = await Promise.all([
    getTranslations("Account"),
    getTranslations("Projects"),
    getClientMessages(["Editor", "Creator", "ProjectStatus", "Projects", "ExternalLink"]),
  ]);
  const links = [
    { href: "/dashboard", label: t("overview") },
    { href: "/dashboard/projects", label: projects("title") },
    { href: "/dashboard/settings", label: t("settings") },
  ];

  return (
    <NextIntlClientProvider messages={messages}>
      <Container className="py-10">
        <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
          {/* Liest den Pfad (aktive Seite) und steht deshalb hinter Suspense. */}
          <Suspense fallback={<SideNavFallback label={t("navLabel")} items={links} />}>
            <SideNav label={t("navLabel")} root="/dashboard" items={links} />
          </Suspense>
          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </NextIntlClientProvider>
  );
}
