import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { AdminPageHeader, ListSkeleton } from "@/components/admin/admin-page";
import { EmptyState } from "@/components/ui/state";
import { getAuditLog } from "@/server/data/admin";
import { requireAdmin } from "@/server/session";

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

async function AuditContent() {
  const locale = await rootLocale();
  await requireAdmin(locale, `/${locale}/admin/audit`);
  const [entries, t, format] = await Promise.all([getAuditLog(), getTranslations("Admin"), getFormatter()]);

  if (entries.length === 0) return <EmptyState title={t("audit.empty")} />;

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

export default async function AdminAuditPage() {
  const t = await getTranslations("Admin");
  return (
    <>
      <AdminPageHeader title={t("audit.title")} description={t("audit.description")} />
      <Suspense fallback={<ListSkeleton rows={6} height="h-12" />}>
        <AuditContent />
      </Suspense>
    </>
  );
}
