import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";

import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let candidate: string | undefined;
  try {
    // Server Components: Sprache aus dem Root-Segment /[locale]
    candidate = await rootLocale();
  } catch {
    // Server Actions / Route Handler: Root-Params sind dort nicht verfügbar
    candidate = await requestLocale;
  }

  const locale = hasLocale(routing.locales, candidate) ? candidate : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Feste Zeitzone verhindert Abweichungen zwischen Server- und Client-Rendering.
    timeZone: "Europe/Berlin",
  };
});
