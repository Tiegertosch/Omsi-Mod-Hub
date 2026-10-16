import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Container } from "@/components/ui/container";
import { getClientMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";

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
  ] as const;

  return (
    <NextIntlClientProvider messages={messages}>
      <Container className="py-10">
        <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav aria-label={t("navLabel")}>
            <ul className="flex gap-1 overflow-x-auto lg:flex-col">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </NextIntlClientProvider>
  );
}
