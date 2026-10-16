import { ArrowRight, FolderKanban, ShieldCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { FormSkeleton } from "@/components/auth/auth-shell";
import { STATUS_TONES } from "@/components/editor/status-tones";
import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";
import { isAdmin, isAppRole } from "@/lib/roles";
import { canManageProjects } from "@/server/creator";
import { countOwnProjectsByStatus } from "@/server/data/creator-projects";
import { requireUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("dashboardTitle"), robots: { index: false, follow: false } };
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-fg">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

async function DashboardContent() {
  const locale = await rootLocale();
  const user = await requireUser(locale, `/${locale}/dashboard`);
  const [t, projectsT, creatorT, statusT, format, counts] = await Promise.all([
    getTranslations("Account"),
    getTranslations("Projects"),
    getTranslations("Creator"),
    getTranslations("ProjectStatus"),
    getFormatter(),
    canManageProjects(user) ? countOwnProjectsByStatus(user) : Promise.resolve<Record<string, number>>({}),
  ]);
  const roleLabel = isAppRole(user.role) ? t(`roles.${user.role}`) : user.role;

  return (
    <>
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-fg">{t("welcome", { name: user.name })}</h1>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card icon={<UserRound aria-hidden className="size-5 text-accent" />} title={t("accountCard")}>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-subtle">{t("username")}</dt>
              <dd className="text-fg">@{user.username}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-subtle">{t("email")}</dt>
              <dd className="flex items-center gap-2 text-fg">
                <span className="truncate">{user.email}</span>
                {user.emailVerified ? <Badge tone="success">{t("emailVerified")}</Badge> : null}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-subtle">{t("role")}</dt>
              <dd>
                <Badge tone="accent">{roleLabel}</Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-subtle">{t("memberSince")}</dt>
              <dd className="text-fg">{format.dateTime(user.createdAt, { dateStyle: "long" })}</dd>
            </div>
          </dl>
          <Link
            href="/dashboard/settings"
            className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
          >
            {t("settings")}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Card>

        <Card icon={<FolderKanban aria-hidden className="size-5 text-accent" />} title={t("projectsCard")}>
          {canManageProjects(user) ? (
            <>
              <p className="text-sm text-muted">
                {projectsT("overviewCount", { count: Object.values(counts).reduce((a, b) => a + b, 0) })}
              </p>
              {Object.keys(counts).length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(counts).map(([status, count]) => (
                    <li key={status}>
                      <Badge tone={STATUS_TONES[status as ProjectStatus]}>
                        {statusT(status as ProjectStatus)}: {count}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted">{creatorT("becomeText")}</p>
          )}
          <Link
            href="/dashboard/projects"
            className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
          >
            {canManageProjects(user) ? projectsT("manage") : creatorT("becomeTitle")}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Card>

        {isAdmin(user.role) ? (
          <Card icon={<ShieldCheck aria-hidden className="size-5 text-accent" />} title={t("adminCard")}>
            <p className="text-sm text-muted">{t("adminCardText")}</p>
            <Link
              href="/admin"
              className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
            >
              {t("admin")}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Card>
        ) : null}
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<FormSkeleton fields={3} />}>
      <DashboardContent />
    </Suspense>
  );
}
