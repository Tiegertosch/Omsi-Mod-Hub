import { ExternalLink, Eye } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { AdminPageHeader, FilterTabs, ListSkeleton } from "@/components/admin/admin-page";
import { ProjectModeration } from "@/components/admin/project-moderation";
import { STATUS_TONES } from "@/components/editor/status-tones";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";
import { ProjectStatus } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";
import { countProjectsByStatus, getReviewQueue } from "@/server/data/review";
import { requireAdmin } from "@/server/session";

type Props = PageProps<"/[locale]/admin/projects">;

const STATUSES = Object.values(ProjectStatus);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Review");
  return { title: t("title"), robots: { index: false, follow: false } };
}

async function ReviewContent({ searchParams }: Pick<Props, "searchParams">) {
  const locale = await rootLocale();
  await requireAdmin(locale, `/${locale}/admin/projects`);
  const { status: rawStatus } = await searchParams;
  const status = STATUSES.find((s) => s === rawStatus) ?? "PENDING_REVIEW";

  const [projects, counts, t, statusT, common, format] = await Promise.all([
    getReviewQueue(status, locale),
    countProjectsByStatus(),
    getTranslations("Review"),
    getTranslations("ProjectStatus"),
    getTranslations("Common"),
    getFormatter(),
  ]);

  return (
    <>
      <FilterTabs
        label={t("filterLabel")}
        active={status}
        hrefFor={(s) => ({ pathname: "/admin/projects", query: { status: s } })}
        items={STATUSES.map((s) => ({
          value: s,
          label: (
            <>
              {statusT(s)}
              <span className="text-xs text-subtle">{counts[s] ?? 0}</span>
            </>
          ),
        }))}
      />

      {projects.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="space-y-4">
          {projects.map((project) => (
            <li
              key={project.id}
              className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 lg:grid-cols-[minmax(0,1fr)_18rem]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-fg">{project.title}</h2>
                  <Badge tone={STATUS_TONES[project.status]}>{statusT(project.status)}</Badge>
                  {project.categoryName ? <Badge>{project.categoryName}</Badge> : null}
                  {project.pricing === "PAYWARE" ? <Badge tone="warning">{common("payware")}</Badge> : null}
                  {project.isSample ? <Badge tone="warning">{common("sample")}</Badge> : null}
                  {project.openReports > 0 ? (
                    <Badge tone="danger">{t("openReports", { count: project.openReports })}</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-subtle">
                  {t("by", { username: project.creator.username })}
                  {project.submittedAt
                    ? ` · ${t("submittedAt", { date: format.dateTime(project.submittedAt, { dateStyle: "medium", timeStyle: "short" }) })}`
                    : null}
                </p>
                {project.summary ? <p className="mt-2 text-sm text-muted">{project.summary}</p> : null}
                {project.moderationNote && (project.status === "REJECTED" || project.status === "HIDDEN") ? (
                  <p className="mt-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
                    <span className="font-medium text-fg">{t("noteLabel")}</span> {project.moderationNote}
                  </p>
                ) : null}
                <div className="mt-3 -ml-3 flex flex-wrap gap-1">
                  <Link
                    href={`/dashboard/projects/${project.id}/preview`}
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                  >
                    <Eye aria-hidden className="size-4" />
                    {t("preview")}
                  </Link>
                  {project.status === "PUBLISHED" ? (
                    <Link href={`/mods/${project.slug}`} className={buttonStyles({ variant: "ghost", size: "sm" })}>
                      <ExternalLink aria-hidden className="size-4" />
                      {t("publicPage")}
                    </Link>
                  ) : null}
                </div>
              </div>
              <ProjectModeration projectId={project.id} status={project.status} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default async function AdminProjectsPage({ searchParams }: Props) {
  const t = await getTranslations("Review");
  return (
    <>
      <AdminPageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<ListSkeleton />}>
        <ReviewContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
