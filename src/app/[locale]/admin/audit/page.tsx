import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { Search } from "lucide-react";

import { AdminPageHeader, ListSkeleton } from "@/components/admin/admin-page";
import { Pagination } from "@/components/mods/pagination";
import { buttonStyles } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/state";
import { AUDIT_AREAS, auditQuery, parseAuditFilter, type AuditArea } from "@/lib/audit-filter";
import { getAuditLog } from "@/server/data/admin";
import { requireAdmin } from "@/server/session";

type Props = PageProps<"/[locale]/admin/audit">;
const AREAS = Object.keys(AUDIT_AREAS) as AuditArea[];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("audit.title"), robots: { index: false, follow: false } };
}

/** Zusatzdaten kompakt anzeigen; der Inhalt stammt aus eigenen Actions und wird nur als Text ausgegeben. */
function formatMetadata(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(value)
      .map(([key, entry]) => `${key}: ${typeof entry === "string" ? entry : JSON.stringify(entry)}`)
      .join(" · ");
  } catch {
    return raw;
  }
}

async function AuditContent({ searchParams }: Pick<Props, "searchParams">) {
  const locale = await rootLocale();
  await requireAdmin(locale, `/${locale}/admin/audit`);
  const filter = parseAuditFilter(await searchParams);
  const [{ entries, pageCount }, t, format] = await Promise.all([
    getAuditLog(filter),
    getTranslations("Admin"),
    getFormatter(),
  ]);

  return (
    <>
      {/* GET-Formular: funktioniert ohne JavaScript, Filter stehen in der Adresse. */}
      <form action={`/${locale}/admin/audit`} method="get" role="search" className="mb-6 flex flex-wrap gap-2">
        <label htmlFor="audit-area" className="sr-only">
          {t("audit.area")}
        </label>
        <select id="audit-area" name="area" defaultValue={filter.area ?? ""} className={`${inputClass} w-auto`}>
          <option value="">{t("audit.allAreas")}</option>
          {AREAS.map((area) => (
            <option key={area} value={area}>
              {t(`audit.areas.${area}`)}
            </option>
          ))}
        </select>
        <label htmlFor="audit-q" className="sr-only">
          {t("audit.search")}
        </label>
        <input
          id="audit-q"
          type="search"
          name="q"
          defaultValue={filter.q}
          maxLength={60}
          placeholder={t("audit.searchPlaceholder")}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button type="submit" className={buttonStyles({ variant: "secondary", className: "h-11" })}>
          <Search aria-hidden className="size-4" />
          <span className="sr-only sm:not-sr-only">{t("audit.filter")}</span>
        </button>
      </form>

      {entries.length === 0 ? <EmptyState title={t("audit.empty")} /> : <AuditTable entries={entries} t={t} format={format} />}

      <Pagination pathname="/admin/audit" query={auditQuery(filter)} page={filter.page} pageCount={pageCount} />
    </>
  );
}

function AuditTable({
  entries,
  t,
  format,
}: {
  entries: Awaited<ReturnType<typeof getAuditLog>>["entries"];
  t: Awaited<ReturnType<typeof getTranslations<"Admin">>>;
  format: Awaited<ReturnType<typeof getFormatter>>;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-border text-xs text-subtle">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              {t("audit.time")}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t("audit.actor")}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t("audit.action")}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t("audit.details")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry) => (
            <tr key={entry.id} className="align-top">
              <td className="px-4 py-3 whitespace-nowrap text-muted">
                {format.dateTime(entry.createdAt, { dateStyle: "short", timeStyle: "medium" })}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-fg">
                {entry.actor ? `@${entry.actor.username}` : t("audit.system")}
              </td>
              <td className="px-4 py-3">
                <code className="text-accent">{entry.action}</code>
                <p className="mt-0.5 text-xs text-subtle">
                  {entry.entityType} {entry.entityId}
                </p>
              </td>
              <td className="max-w-md px-4 py-3 break-words text-muted">{formatMetadata(entry.metadata)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminAuditPage({ searchParams }: Props) {
  const t = await getTranslations("Admin");
  return (
    <>
      <AdminPageHeader title={t("audit.title")} description={t("audit.description")} />
      <Suspense fallback={<ListSkeleton rows={6} height="h-12" />}>
        <AuditContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
