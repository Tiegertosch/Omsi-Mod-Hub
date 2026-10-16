import { Eye } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { AdminPageHeader, FilterTabs, ListSkeleton } from "@/components/admin/admin-page";
import { ProjectModeration } from "@/components/admin/project-moderation";
import { ReportActions } from "@/components/admin/report-actions";
import { STATUS_TONES } from "@/components/editor/status-tones";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";
import { ReportStatus } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";
import { availableReportActions } from "@/lib/moderation";
import { countReportsByStatus, getReports } from "@/server/data/admin";
import { requireAdmin } from "@/server/session";

type Props = PageProps<"/[locale]/admin/reports">;

const STATUSES = Object.values(ReportStatus);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("reports.title"), robots: { index: false, follow: false } };
}

async function ReportsContent({ searchParams }: Pick<Props, "searchParams">) {
  const locale = await rootLocale();
  await requireAdmin(locale, `/${locale}/admin/reports`);
  const { status: rawStatus } = await searchParams;
  const status = STATUSES.find((s) => s === rawStatus) ?? "OPEN";

  const [reports, counts, t, reportT, statusT, format] = await Promise.all([
    getReports(status, locale),
    countReportsByStatus(),
    getTranslations("Admin"),
    getTranslations("Report"),
    getTranslations("ProjectStatus"),
    getFormatter(),
  ]);
  const dateTime = (date: Date) => format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <FilterTabs
        label={t("reports.filterLabel")}
        active={status}
        hrefFor={(s) => ({ pathname: "/admin/reports", query: { status: s } })}
        items={STATUSES.map((s) => ({
          value: s,
          label: (
            <>
              {t(`reports.status.${s}`)}
              <span className="text-xs text-subtle">{counts[s] ?? 0}</span>
            </>
          ),
        }))}
      />

      {reports.length === 0 ? (
        <EmptyState title={t("reports.empty")} />
      ) : (
        <ul className="space-y-4">
          {reports.map((report) => (
            <li
              key={report.id}
              className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 lg:grid-cols-[minmax(0,1fr)_18rem]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="danger">{reportT(`reasons.${report.reason}`)}</Badge>
                  <h2 className="font-semibold text-fg">{report.project.title}</h2>
                  <Badge tone={STATUS_TONES[report.project.status]}>{statusT(report.project.status)}</Badge>
                  {report.project.openReports > 1 ? (
                    <Badge tone="warning">{t("reports.moreOpen", { count: report.project.openReports })}</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-subtle">
                  {t("reports.reportedBy", {
                    reporter: report.reporter ? `@${report.reporter.username}` : t("guest"),
                    date: dateTime(report.createdAt),
                  })}{" "}
                  · {t("reports.creator", { username: report.project.creatorUsername })}
                </p>
                {report.description ? (
                  <blockquote className="mt-3 border-l-2 border-border-strong pl-3 text-sm whitespace-pre-line text-muted">
                    {report.description}
                  </blockquote>
                ) : (
                  <p className="mt-3 text-sm text-subtle italic">{t("reports.noDescription")}</p>
                )}
                {report.resolutionNote ? (
                  <p className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
                    <span className="font-medium text-fg">{t("reports.internalNote")}</span> {report.resolutionNote}
                  </p>
                ) : null}
                {report.resolvedAt ? (
                  <p className="mt-2 text-xs text-subtle">
                    {t("reports.closedBy", {
                      admin: report.resolvedBy ? `@${report.resolvedBy.username}` : "–",
                      date: dateTime(report.resolvedAt),
                    })}
                  </p>
                ) : null}
                <div className="mt-3 -ml-3 flex flex-wrap gap-1">
                  <Link
                    href={`/dashboard/projects/${report.project.id}/preview`}
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                  >
                    <Eye aria-hidden className="size-4" />
                    {t("reports.viewProject")}
                  </Link>
                </div>
              </div>
              <div className="space-y-4">
                <ReportActions reportId={report.id} actions={availableReportActions(report.status)} />
                {report.project.status === "PUBLISHED" || report.project.status === "HIDDEN" ? (
                  <ProjectModeration projectId={report.project.id} status={report.project.status} instanceId={report.id} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default async function AdminReportsPage({ searchParams }: Props) {
  const t = await getTranslations("Admin");
  return (
    <>
      <AdminPageHeader title={t("reports.title")} description={t("reports.description")} />
      <Suspense fallback={<ListSkeleton />}>
        <ReportsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
