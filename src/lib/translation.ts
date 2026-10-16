export type Localized = { locale: string };

/**
 * Wählt die passende Übersetzung: gewünschte Sprache, sonst Originalsprache
 * des Datensatzes, sonst die erste vorhandene.
 */
export function pickTranslation<T extends Localized>(
  translations: readonly T[],
  locale: string,
  fallbackLocale?: string,
): { translation: T; isFallback: boolean } | null {
  const exact = translations.find((t) => t.locale === locale);
  if (exact) return { translation: exact, isFallback: false };

  const fallback =
    (fallbackLocale ? translations.find((t) => t.locale === fallbackLocale) : undefined) ?? translations[0];
  return fallback ? { translation: fallback, isFallback: true } : null;
}
