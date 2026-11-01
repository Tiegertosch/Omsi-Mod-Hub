/**
 * Filter und Seiten des Admin-Protokolls (/admin/audit). Bereiche entsprechen
 * dem `entityType` der Einträge; die Suche prüft den Aktionsnamen
 * (z. B. „ban“ findet user.ban und user.unban).
 */
export const AUDIT_AREAS = {
  project: "Project",
  report: "Report",
  user: "User",
  link: "ExternalLink",
  category: "Category",
  tag: "Tag",
} as const;
export type AuditArea = keyof typeof AUDIT_AREAS;

export const AUDIT_PAGE_SIZE = 50;
const MAX_PAGE = 1_000;

export type AuditFilter = { area: AuditArea | null; q: string; page: number };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseAuditFilter(params: Record<string, string | string[] | undefined>): AuditFilter {
  const area = first(params.area);
  const q = (first(params.q) ?? "").trim().toLowerCase().slice(0, 60);
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    area: area && Object.hasOwn(AUDIT_AREAS, area) ? (area as AuditArea) : null,
    // Aktionsnamen bestehen aus Buchstaben, Punkten und Unterstrichen; verglichen wird ohne Groß-/Kleinschreibung.
    q: /^[a-z._]*$/.test(q) ? q : "",
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1,
  };
}

/** Query für Seitenlinks (ohne `page`, die setzt die Pagination); leere Filter fallen weg. */
export function auditQuery(filter: AuditFilter): Record<string, string> {
  return { ...(filter.area ? { area: filter.area } : {}), ...(filter.q ? { q: filter.q } : {}) };
}
