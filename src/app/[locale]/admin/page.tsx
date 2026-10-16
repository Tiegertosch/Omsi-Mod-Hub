import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Notice, Skeleton } from "@/components/ui/state";
import { Link } from "@/i18n/navigation";
import { isAppRole } from "@/lib/roles";
import { pickTranslation } from "@/lib/translation";
import { getAdminOverview } from "@/server/data/admin";
import { requireAdmin } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("title"), robots: { index: false, follow: false } };
}

async function AdminContent() {
  const locale = await rootLocale();
  await requireAdmin(locale, `/${locale}/admin`);
  const [{ stats, latestReports, latestUsers }, t, account, report, common, review, format] = await Promise.all([
    getAdminOverview(),
    getTranslations("Admin"),
    getTranslations("Account"),
    getTranslations("Report"),
    getTranslations("Common"),
    getTranslations("Review"),
    getFormatter(),
  ]);

  const statItems = [
    { label: t("stats.users"), value: stats.users },
    { label: t("stats.creators"), value: stats.creators },
    { label: t("stats.published"), value: stats.published },
    { label: t("stats.pending"), value: stats.pending },
    { label: t("stats.openReports"), value: stats.openReports },
  ];

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statItems.map((item) => (
          <div key={item.label} className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
            <dt className="text-xs text-subtle">{item.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold text-fg">{format.number(item.value)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href="/admin/projects" className={buttonStyles()}>
          {review("toReview")}
          {stats.pendingReview > 0 ? (
            <Badge className="border-accent-fg/20 bg-accent-fg/10 text-accent-fg">{stats.pendingReview}</Badge>
          ) : null}
        </Link>
      </div>

      <Notice tone="info" className="mt-6">
        {t("actionsSoon")}
      </Notice>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="reports" className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
          <h2 id="reports" className="mb-4 text-lg font-semibold text-fg">
            {t("reportsTitle")}
          </h2>
          {latestReports.length === 0 ? (
            <p className="text-sm text-muted">{t("noReports")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {latestReports.map((item) => (
                <li key={item.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="danger">{report(`reasons.${item.reason}`)}</Badge>
                    <Link href={`/mods/${item.project.slug}`} className="font-medium text-fg hover:text-accent">
                      {pickTranslation(item.project.translations, locale)?.translation.title ?? item.project.slug}
                    </Link>
                  </div>
                  {item.description ? <p className="mt-1.5 line-clamp-2 text-muted">{item.description}</p> : null}
                  <p className="mt-1 text-xs text-subtle">
                    {item.reporter ? `@${item.reporter.username}` : t("guest")} ·{" "}
                    {format.dateTime(item.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="users" className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
          <h2 id="users" className="mb-4 text-lg font-semibold text-fg">
            {t("usersTitle")}
          </h2>
          <ul className="divide-y divide-border">
            {latestUsers.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{user.name}</p>
                  <p className="text-xs text-subtle">
                    @{user.username} · {format.dateTime(user.createdAt, { dateStyle: "medium" })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="accent">{isAppRole(user.role) ? account(`roles.${user.role}`) : user.role}</Badge>
                  {!user.emailVerified ? <Badge>{t("unverified")}</Badge> : null}
                  {user.banned ? <Badge tone="danger">{t("banned")}</Badge> : null}
                  {user.isSample ? <Badge tone="warning">{common("sample")}</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

export default async function AdminPage() {
  const t = await getTranslations("Admin");
  return (
    <Container className="py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-fg">{t("title")}</h1>
        <p className="mt-2 text-muted">{t("description")}</p>
      </header>
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-busy="true">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-20 rounded-[var(--radius-card)]" />
            ))}
          </div>
        }
      >
        <AdminContent />
      </Suspense>
    </Container>
  );
}
