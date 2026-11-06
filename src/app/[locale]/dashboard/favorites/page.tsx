import { Bell, BellOff, Bookmark } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { getFavoriteToggleLabels } from "@/components/mods/favorite-button";
import { FavoriteToggle } from "@/components/mods/favorite-toggle";
import { ProjectCard } from "@/components/mods/project-card";
import { ProjectGridSkeleton } from "@/components/mods/project-grid";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";
import { Link } from "@/i18n/navigation";
import { getProjectUpdateSetting } from "@/server/data/favorites";
import { getFavoriteProjects } from "@/server/data/projects";
import { requireUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Favorites");
  return { title: t("title"), robots: { index: false, follow: false } };
}

async function FavoritesContent() {
  const locale = await rootLocale();
  const user = await requireUser(locale, `/${locale}/dashboard/favorites`);
  const [t, list, notify, labels] = await Promise.all([
    getTranslations("Favorites"),
    getFavoriteProjects(user.id, locale),
    getProjectUpdateSetting(user.id),
    getFavoriteToggleLabels(),
  ]);

  if (list.available.length === 0 && list.unavailable.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title={t("empty")}
        action={
          <Link href="/mods" className={buttonStyles({ variant: "primary" })}>
            {t("browse")}
          </Link>
        }
      >
        {t("emptyHint")}
      </EmptyState>
    );
  }

  const NotifyIcon = notify ? Bell : BellOff;
  return (
    <div className="space-y-8">
      <p className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
        <NotifyIcon aria-hidden className="size-4 text-accent" />
        {notify ? t("notifyOn") : t("notifyOff")}
        <Link href="/dashboard/settings/account#notifications" className="font-medium text-accent hover:text-accent-hover">
          {t("manage")}
        </Link>
      </p>

      {list.available.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.available.map((project) => (
            <li key={project.id} className="flex flex-col gap-2">
              <div className="flex flex-1">
                <ProjectCard project={project} />
              </div>
              <FavoriteToggle projectId={project.id} saved labels={labels} title={project.title} />
            </li>
          ))}
        </ul>
      ) : null}

      {list.unavailable.length > 0 ? (
        <section aria-labelledby="favorites-unavailable">
          <h2 id="favorites-unavailable" className="mb-2 text-lg font-semibold text-fg">
            {t("unavailableTitle")}
          </h2>
          <p className="mb-4 text-sm text-muted">{t("unavailableHint")}</p>
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
            {list.unavailable.map((project) => (
              <li key={project.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="min-w-0 truncate text-sm text-fg">{project.title}</span>
                <div className="w-44 shrink-0">
                  <FavoriteToggle projectId={project.id} saved labels={labels} title={project.title} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default async function FavoritesPage() {
  const t = await getTranslations("Favorites");
  return (
    <>
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-fg">{t("title")}</h1>
      <p className="mb-8 text-muted">{t("intro")}</p>
      <Suspense fallback={<ProjectGridSkeleton count={3} />}>
        <FavoritesContent />
      </Suspense>
    </>
  );
}
