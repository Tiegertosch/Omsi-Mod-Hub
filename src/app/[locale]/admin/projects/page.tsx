import { ArrowLeft, Eye } from "lucide-react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { ReviewActions } from "@/components/admin/review-actions";
import { STATUS_TONES } from "@/components/editor/status-tones";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState, Skeleton } from "@/components/ui/state";
import { ProjectStatus } from "@/generated/prisma/enums";
import { getClientMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { getReviewQueue } from "@/server/data/review";
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

  const [projects, t, statusT, common, format, messages] = await Promise.all([
    getReviewQueue(status, locale),
    getTranslations("Review"),
    getTranslations("ProjectStatus"),
    getTranslations("Common"),
    getFormatter(),
    getClientMessages(["Editor", "Review"]),
  ]);

  return (
    <NextIntlClientProvider messages={messages}>
      <nav aria-label={t("filterLabel")} className="mb-6 -mx-4 overflow-x-auto px-4">
        <ul className="flex w-max gap-2">
          {STATUSES.map((s) => (
            <li key={s}>
              <Link
                href={{ pathname: "/admin/projects", query: { status: s } }}
                aria-current={s === status ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                  s === status ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-muted hover:text-fg",
                )}
              >
                {statusT(s)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

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
                  {project.isSample ? <Badge tone="warning">{common("sample")}</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-subtle">
                  {t("by", { username: project.creator.username })}
                  {project.submittedAt
                    ? ` · ${t("submittedAt", { date: format.dateTime(project.submittedAt, { dateStyle: "medium", timeStyle: "short" }) })}`
                    : null}
                </p>
                {project.summary ? <p className="mt-2 text-sm text-muted">{project.summary}</p> : null}
                <Link
                  href={`/dashboard/projects/${project.id}/preview`}
                  className={buttonStyles({ variant: "ghost", size: "sm", className: "mt-3 -ml-3" })}
                >
                  <Eye aria-hidden className="size-4" />
                  {t("preview")}
                </Link>
              </div>
              {project.status === "PENDING_REVIEW" ? <ReviewActions projectId={project.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </NextIntlClientProvider>
  );
}

export default async function AdminProjectsPage({ searchParams }: Props) {
  const [t, admin] = await Promise.all([getTranslations("Review"), getTranslations("Admin")]);
  return (
    <Container className="py-10">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft aria-hidden className="size-4" />
        {admin("title")}
      </Link>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-fg">{t("title")}</h1>
        <p className="mt-2 text-muted">{t("description")}</p>
      </header>
      <Suspense
        fallback={
          <div className="space-y-4" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-32 rounded-[var(--radius-card)]" />
            ))}
          </div>
        }
      >
        <ReviewContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
