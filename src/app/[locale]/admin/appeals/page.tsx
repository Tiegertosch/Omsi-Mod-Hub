import { Eye } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { AdminPageHeader, FilterTabs, ListSkeleton } from "@/components/admin/admin-page";
import { AppealActions } from "@/components/admin/appeal-actions";
import { STATUS_TONES } from "@/components/editor/status-tones";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";
import { Link } from "@/i18n/navigation";
import { ADMIN_APPEAL_STATUSES, countAppealsByStatus, getAppeals } from "@/server/data/appeals";
import { requireAdmin } from "@/server/session";

type Props = PageProps<"/[locale]/admin/appeals">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("appeals.title"), robots: { index: false, follow: false } };
}

async function AppealsContent({ searchParams }: Pick<Props, "searchParams">) {
  const locale = await rootLocale();
  await requireAdmin(locale, `/${locale}/admin/appeals`);
  const { status: rawStatus } = await searchParams;
  const status = ADMIN_APPEAL_STATUSES.find((s) => s === rawStatus) ?? "OPEN";

  const [appeals, counts, t, appealT, statusT, format] = await Promise.all([
    getAppeals(status, locale),
    countAppealsByStatus(),
    getTranslations("Admin"),
    getTranslations("Appeal"),
    getTranslations("ProjectStatus"),
    getFormatter(),
  ]);
  const dateTime = (date: Date) => format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <FilterTabs
        label={t("appeals.filterLabel")}
        active={status}
        hrefFor={(s) => ({ pathname: "/admin/appeals", query: { status: s } })}
        items={ADMIN_APPEAL_STATUSES.map((s) => ({
          value: s,
          label: (
            <>
              {t(`appeals.status.${s}`)}
              <span className="text-xs text-subtle">{counts[s] ?? 0}</span>
            </>
          ),
        }))}
      />

      {appeals.length === 0 ? (
        <EmptyState title={t("appeals.empty")} />
      ) : (
        <ul className="space-y-4">
          {appeals.map((appeal) => (
            <li
              key={appeal.id}
              className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 lg:grid-cols-[minmax(0,1fr)_18rem]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="warning">{appealT(`kind.${appeal.kind}`)}</Badge>
                  <h2 className="font-semibold text-fg">{appeal.project.title}</h2>
                  <Badge tone={STATUS_TONES[appeal.project.status]}>{statusT(appeal.project.status)}</Badge>
                </div>
                <p className="mt-1 text-xs text-subtle">
                  {t("appeals.appealedBy", {
                    username: appeal.project.creatorUsername,
                    date: dateTime(appeal.appealedAt ?? appeal.createdAt),
                  })}{" "}
                  · {t("appeals.decidedOn", { date: dateTime(appeal.createdAt) })}
                </p>
                <h3 className="mt-3 text-xs font-medium tracking-wide text-subtle uppercase">{t("appeals.reason")}</h3>
                <p className="mt-1 text-sm whitespace-pre-line text-muted">{appeal.reason}</p>
                <h3 className="mt-3 text-xs font-medium tracking-wide text-subtle uppercase">{t("appeals.message")}</h3>
                <blockquote className="mt-1 border-l-2 border-border-strong pl-3 text-sm whitespace-pre-line text-fg">
                  {appeal.appealMessage}
                </blockquote>
                {appeal.resolutionNote ? (
                  <p className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
                    <span className="font-medium text-fg">{t("appeals.resolutionNote")}:</span> {appeal.resolutionNote}
                  </p>
                ) : null}
                {appeal.resolvedAt ? (
                  <p className="mt-2 text-xs text-subtle">
                    {t("appeals.resolvedBy", {
                      admin: appeal.resolvedBy ? `@${appeal.resolvedBy.username}` : "–",
                      date: dateTime(appeal.resolvedAt),
                    })}
                  </p>
                ) : null}
                <div className="mt-3 -ml-3 flex flex-wrap gap-1">
                  <Link
                    href={`/dashboard/projects/${appeal.project.id}/preview`}
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                  >
                    <Eye aria-hidden className="size-4" />
                    {t("appeals.viewProject")}
                  </Link>
                </div>
              </div>
              {status === "OPEN" ? <AppealActions decisionId={appeal.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default async function AdminAppealsPage({ searchParams }: Props) {
  const t = await getTranslations("Admin");
  return (
    <>
      <AdminPageHeader title={t("appeals.title")} description={t("appeals.description")} />
      <Suspense fallback={<ListSkeleton />}>
        <AppealsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
