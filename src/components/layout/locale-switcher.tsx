"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Link, usePathname } from "@/i18n/navigation";

import { LocaleLinks } from "./locale-links";

/** Wechselt die Sprache und behält Pfad sowie Suchparameter bei. */
export function LocaleSwitcher({ label }: { label: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = Object.fromEntries(
    Array.from(new Set(searchParams.keys())).map((key) => [key, searchParams.getAll(key)]),
  );

  return (
    <LocaleLinks
      label={label}
      current={locale}
      renderLink={(target, children, className) => (
        <Link href={{ pathname, query }} locale={target} hrefLang={target} className={className}>
          {children}
        </Link>
      )}
    />
  );
}
