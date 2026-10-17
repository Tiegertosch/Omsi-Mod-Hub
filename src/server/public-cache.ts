import "server-only";

import { revalidateTag, updateTag } from "next/cache";

/**
 * Zwischenspeicherung der öffentlichen Daten mit `use cache`.
 *
 * Tags:
 * - `lists`:    Katalog, Suche, Startseiten-Listen, Creator-Verzeichnis, Sitemap,
 *               Zähler. Wird bei Änderungen im Hintergrund erneuert
 *               (stale-while-revalidate): Besucher warten nicht, sehen aber kurz
 *               noch den alten Stand.
 * - `project:<slug>`, `creator:<username>`: Detailseiten. Werden sofort
 *               invalidiert, damit Creator und Admins ihre Änderung direkt sehen.
 * - `taxonomy`: Kategorien und Tags. Sofort invalidiert; betrifft auch alle
 *               Detailseiten, weil dort Kategorie- und Tag-Namen stehen.
 *
 * Ein einziger grober Tag mit sofortiger Invalidierung wäre einfacher, lässt
 * aber nach jeder Änderung alle Seiten und Prefetches blockierend neu rendern.
 *
 * Lebensdauer: "minutes" für alles mit Aufrufzahlen (Klicks über /go
 * invalidieren nicht), "hours" für Kategorien und Tags. Änderungen direkt in
 * der Datenbank (Seed, Prisma Studio, CLI) werden spätestens danach oder nach
 * einem Neustart sichtbar.
 */
export const CACHE_TAGS = {
  lists: "public:lists",
  taxonomy: "public:taxonomy",
  project: (slug: string) => `public:project:${slug}`,
  creator: (username: string) => `public:creator:${username}`,
} as const;

function refreshLists() {
  revalidateTag(CACHE_TAGS.lists, "max");
}

/** Nach Änderungen an Projekten (Inhalt, Status, Medien, Versionen). Nur in Server Actions. */
export function projectsChanged(slugs: readonly string[]): void {
  for (const slug of new Set(slugs)) updateTag(CACHE_TAGS.project(slug));
  refreshLists();
}

/** Nach Änderungen an einem Creator (Profil, Sperre). Nur in Server Actions. */
export function creatorChanged(username: string): void {
  updateTag(CACHE_TAGS.creator(username));
  refreshLists();
}

/** Nach Änderungen an Kategorien oder Tags. Nur in Server Actions. */
export function taxonomyChanged(): void {
  updateTag(CACHE_TAGS.taxonomy);
  refreshLists();
}
