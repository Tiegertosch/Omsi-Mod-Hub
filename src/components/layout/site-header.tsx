import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";

import { AccountArea, AccountAreaFallback } from "@/components/account/account-area";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

import { ActiveNavLinks } from "./active-nav-links";
import { LocaleLinks } from "./locale-links";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { NavLinkList, type NavItem } from "./nav-links";
import { SearchForm } from "./search-form";

/** Fallback ohne Pfad-Erhalt, solange der aktuelle Pfad noch nicht bekannt ist. */
function StaticLocaleLinks({ label, current }: { label: string; current: string }) {
  return (
    <LocaleLinks
      label={label}
      current={current}
      renderLink={(target: AppLocale, children, className) => (
        <Link href="/" locale={target} hrefLang={target} className={className}>
          {children}
        </Link>
      )}
    />
  );
}

export function LanguageSwitch() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  return (
    <Suspense fallback={<StaticLocaleLinks label={t("language")} current={locale} />}>
      <LocaleSwitcher label={t("language")} />
    </Suspense>
  );
}

export function SiteHeader() {
  const t = useTranslations("Nav");

  const items: NavItem[] = [
    { href: "/mods", label: t("mods") },
    { href: "/creators", label: t("creators") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        {t("skipToContent")}
      </a>
      <div className="relative mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav aria-label={t("mainNavigation")} className="hidden md:block">
          <Suspense fallback={<NavLinkList items={items} activeHref={null} />}>
            <ActiveNavLinks items={items} />
          </Suspense>
        </nav>

        <div className="ml-auto hidden w-full max-w-xs md:block lg:max-w-sm">
          <SearchForm id="header-search" />
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <LanguageSwitch />
          <Suspense fallback={<AccountAreaFallback />}>
            <AccountArea />
          </Suspense>
          <MobileMenu openLabel={t("openMenu")} closeLabel={t("closeMenu")}>
            <SearchForm id="mobile-search" className="mb-4" />
            <nav aria-label={t("mainNavigation")}>
              <Suspense fallback={<NavLinkList items={items} activeHref={null} orientation="vertical" />}>
                <ActiveNavLinks items={items} orientation="vertical" />
              </Suspense>
            </nav>
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
