import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["de", "en"],
  // Gäste erhalten ihre Sprache per Accept-Language; Englisch ist der Fallback
  // für alle anderen Sprachen des internationalen Publikums.
  defaultLocale: "en",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];

export const localeLabels: Record<AppLocale, string> = {
  de: "Deutsch",
  en: "English",
};
