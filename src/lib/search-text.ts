/**
 * Normalisierung für die portable Volltextsuche.
 *
 * Projekttexte werden beim Speichern in eine kleingeschriebene Suchspalte
 * (`ProjectTranslation.searchText`) übertragen. Suchanfragen werden identisch
 * normalisiert und per `contains` (LIKE) abgeglichen – unabhängig von
 * Groß-/Kleinschreibung und Umlauten. Für größere Datenmengen ist die
 * PostgreSQL-Volltextsuche (tsvector) bzw. ein pg_trgm-Index vorgesehen.
 */

export const MAX_QUERY_LENGTH = 100;
export const MAX_QUERY_TERMS = 6;

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("de").replace(/\s+/g, " ").trim();
}

export function buildSearchText(parts: {
  title: string;
  summary: string;
  description: string;
  tags?: readonly string[];
  extra?: readonly (string | null | undefined)[];
}): string {
  return normalizeSearchText(
    [parts.title, parts.summary, parts.description, ...(parts.tags ?? []), ...(parts.extra ?? [])]
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * Zerlegt eine Suchanfrage in Suchbegriffe. SQL-Wildcards (% _) und Backslashes
 * werden entfernt, damit Nutzer keine teuren Muster einschleusen können.
 */
export function tokenizeQuery(query: string): string[] {
  const cleaned = normalizeSearchText(query.slice(0, MAX_QUERY_LENGTH)).replace(/[%_\\]/g, " ");
  const terms = cleaned
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
  return Array.from(new Set(terms)).slice(0, MAX_QUERY_TERMS);
}
