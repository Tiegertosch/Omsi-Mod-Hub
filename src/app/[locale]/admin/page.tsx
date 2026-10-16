import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { AdminCard, AdminPageHeader } from "@/components/admin/admin-page";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/state";
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
  const [{ stats, latestReports, latestUsers }, t, account, report, common, format] = await Promise.all([
    getAdminOverview(),
    getTranslations("Admin"),
    getTranslations("Account"),
    getTranslations("Report"),
    getTranslations("Common"),
    getFormatter(),
  ]);

  const statItems = [
    { label: t("stats.users"), value: stats.users, href: "/admin/users" },
    { label: t("stats.creators"), value: stats.creators, href: "/admin/users?filter=creator" },
    { label: t("stats.published"), value: stats.published, href: "/admin/projects?status=PUBLISHED" },
    { label: t("stats.pendingReview"), value: stats.pendingReview, href: "/admin/projects" },
    { label: t("stats.openReports"), value: stats.openReports, href: "/admin/reports" },
  ];

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {statItems.map((item) => (
          <div
            key={item.label}
            className="relative rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors hover:border-border-strong"
          >
            <dt className="text-xs text-subtle">
              <Link href={item.href} className="after:absolute after:inset-0">
                {item.label}
              </Link>
            </dt>
            <dd className="mt-1 font-display text-3xl font-semibold text-fg">{format.number(item.value)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <AdminCard>
          <section aria-labelledby="reports">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 id="reports" className="text-lg font-semibold text-fg">
                {t("reportsTitle")}
              </h2>
              <Link href="/admin/reports" className="text-sm text-accent hover:underline">
                {common("showAll")}
              </Link>
            </div>
            {latestReports.length === 0 ? (
              <p className="text-sm text-muted">{t("noReports")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {latestReports.map((item) => (
                  <li key={item.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="danger">{report(`reasons.${item.reason}`)}</Badge>
                      <span className="font-medium text-fg">
                        {pickTranslation(item.project.translations, locale)?.translation.title ?? item.project.slug}
                      </span>
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
        </AdminCard>

        <AdminCard>
          <section aria-labelledby="users">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 id="users" className="text-lg font-semibold text-fg">
                {t("usersTitle")}
              </h2>
              <Link href="/admin/users" className="text-sm text-accent hover:underline">
                {common("showAll")}
              </Link>
            </div>
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
        </AdminCard>
      </div>
    </>
  );
}

export default async function AdminPage() {
  const t = await getTranslations("Admin");
  return (
    <>
      <AdminPageHeader title={t("title")} description={t("description")} />
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-busy="true">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-20 rounded-[var(--radius-card)]" />
            ))}
          </div>
        }
      >
        <AdminContent />
      </Suspense>
    </>
  );
}
