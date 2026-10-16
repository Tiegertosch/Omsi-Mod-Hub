import type { Metadata } from "next";

import { routing } from "@/i18n/routing";

/**
 * Kanonische URL und hreflang-Alternativen für einen lokalisierungsfreien Pfad
 * (z. B. "/mods/busse"). Relative Angaben werden über metadataBase aufgelöst.
 */
export function localizedAlternates(locale: string, path: string): Metadata["alternates"] {
  const suffix = path === "/" ? "" : path;
  return {
    canonical: `/${locale}${suffix}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}${suffix}`])),
      "x-default": `/${routing.defaultLocale}${suffix}`,
    },
  };
}

/** Kürzt Fließtext für Meta-Beschreibungen auf eine sinnvolle Länge. */
export function truncateDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20))}…`;
}
