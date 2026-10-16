import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { Container } from "@/components/ui/container";
import { getClientMessages } from "@/i18n/client-messages";
import { isAdmin } from "@/lib/roles";
import { getAdminBadgeCounts } from "@/server/data/admin";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Navigation nur für Admins rendern, damit der Bereich für andere nicht sichtbar wird. */
async function AdminNavigation() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) return null;
  const [t, counts] = await Promise.all([getTranslations("Admin"), getAdminBadgeCounts()]);
  return (
    <AdminNav
      label={t("navLabel")}
      items={[
        { href: "/admin", label: t("nav.overview") },
        { href: "/admin/projects", label: t("nav.projects"), count: counts.pendingReview },
        { href: "/admin/reports", label: t("nav.reports"), count: counts.openReports },
        { href: "/admin/users", label: t("nav.users") },
        { href: "/admin/categories", label: t("nav.categories") },
        { href: "/admin/tags", label: t("nav.tags") },
        { href: "/admin/audit", label: t("nav.audit") },
      ]}
    />
  );
}

/**
 * Wie im Dashboard ohne eigene Zugriffsprüfung für die Inhalte: Layouts werden
 * bei Navigationen nicht neu gerendert. Jede Seite, Datenfunktion und Action
 * prüft die Admin-Rolle selbst.
 */
export default async function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const messages = await getClientMessages(["Admin", "Review", "Editor", "ProjectStatus"]);
  return (
    <NextIntlClientProvider messages={messages}>
      <Container className="py-10">
        <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <div>
            <Suspense fallback={null}>
              <AdminNavigation />
            </Suspense>
          </div>
          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </NextIntlClientProvider>
  );
}
