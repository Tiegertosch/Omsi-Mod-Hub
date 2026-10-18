import { useTranslations } from "next-intl";

import { Container } from "@/components/ui/container";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/site";

import { Logo } from "./logo";
import { LanguageSwitch } from "./site-header";

export function SiteFooter() {
  const t = useTranslations("Footer");
  const nav = useTranslations("Nav");

  const columns = [
    {
      title: t("explore"),
      links: [
        { href: "/mods", label: nav("mods") },
        { href: "/creators", label: nav("creators") },
        { href: "/search", label: nav("search") },
      ],
    },
    {
      title: t("legal"),
      links: [
        { href: "/legal/imprint", label: t("imprint") },
        { href: "/legal/privacy", label: t("privacy") },
        { href: "/legal/terms", label: t("terms") },
      ],
    },
  ] as const;

  return (
    <footer className="mt-24 border-t border-border bg-surface/60">
      <Container className="grid gap-10 py-12 md:grid-cols-[2fr_1fr_1fr_auto]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm text-muted">{t("tagline")}</p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <h2 className="text-sm font-semibold text-fg">{column.title}</h2>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted transition-colors hover:text-fg">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-fg">{t("language")}</h2>
          <LanguageSwitch />
        </div>
      </Container>
      <div className="border-t border-border">
        <Container className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-5 text-xs text-subtle">
          <p>{t("trademark")}</p>
          <a href={siteConfig.sourceUrl} rel="noopener" className="transition-colors hover:text-fg">
            {t("sourceCode")}
          </a>
        </Container>
      </div>
    </footer>
  );
}
