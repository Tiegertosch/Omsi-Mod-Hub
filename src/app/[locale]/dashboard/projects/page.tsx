import { FolderPlus, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Image from "next/image";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { FormSkeleton } from "@/components/auth/auth-shell";
import { CreatorProfileForm } from "@/components/creator/creator-profile-form";
import { STATUS_TONES } from "@/components/editor/status-tones";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";
import { Link } from "@/i18n/navigation";
import { isSafeImageSrc } from "@/lib/external-url";
import { canManageProjects } from "@/server/creator";
import { listOwnProjects } from "@/server/data/creator-projects";
import { requireUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Projects");
  return { title: t("title"), robots: { index: false, follow: false } };
}

async function ProjectsContent() {
  const locale = await rootLocale();
  const user = await requireUser(locale, `/${locale}/dashboard/projects`);
  const [t, creatorT, statusT, format] = await Promise.all([
    getTranslations("Projects"),
    getTranslations("Creator"),
    getTranslations("ProjectStatus"),
    getFormatter(),
  ]);

  if (!canManageProjects(user)) {
    return (
      <section aria-labelledby="become" className="max-w-2xl rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <h2 id="become" className="text-xl font-semibold text-fg">
          {creatorT("becomeTitle")}
        </h2>
        <p className="mt-2 mb-6 text-sm text-muted">{creatorT("becomeText")}</p>
        <CreatorProfileForm mode="create" initial={{ displayName: user.name, bio: "", websiteUrl: "" }} />
      </section>
    );
  }

  const projects = await listOwnProjects(user, locale);

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderPlus}
        title={t("emptyTitle")}
        action={
          <Link href="/dashboard/projects/new" className={buttonStyles()}>
            <Plus aria-hidden className="size-4" />
            {t("newProject")}
          </Link>
        }
      >
        {t("emptyText")}
      </EmptyState>
    );
  }

  return (
    <ul className="space-y-3">
      {projects.map((project) => (
        <li
          key={project.id}
          className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:flex-row sm:items-center"
        >
          <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-md bg-surface-3 sm:w-36">
            {isSafeImageSrc(project.coverImageUrl) ? (
              <Image src={project.coverImageUrl} alt="" fill sizes="144px" unoptimized className="object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-semibold text-fg">{project.title}</h2>
              <Badge tone={STATUS_TONES[project.status]}>{statusT(project.status)}</Badge>
            </div>
            <p className="mt-1 text-xs text-subtle">
              {project.latestVersion ? `v${project.latestVersion}` : t("noVersion")} ·{" "}
              {t("updated", { date: format.dateTime(project.updatedAt, { dateStyle: "medium" }) })}
            </p>
            {project.status === "REJECTED" && project.moderationNote ? (
              <p className="mt-2 line-clamp-2 text-sm text-danger">
                {t("moderationNote")}: {project.moderationNote}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/projects/${project.id}/edit`} className={buttonStyles({ variant: "secondary", size: "sm" })}>
              {t("edit")}
            </Link>
            {project.status === "PUBLISHED" ? (
              <Link href={`/mods/${project.slug}`} className={buttonStyles({ variant: "ghost", size: "sm" })}>
                {t("viewPublic")}
              </Link>
            ) : (
              <Link href={`/dashboard/projects/${project.id}/preview`} className={buttonStyles({ variant: "ghost", size: "sm" })}>
                {t("preview")}
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

async function NewProjectButton() {
  const locale = await rootLocale();
  const user = await requireUser(locale, `/${locale}/dashboard/projects`);
  if (!canManageProjects(user)) return null;
  const t = await getTranslations("Projects");
  return (
    <Link href="/dashboard/projects/new" className={buttonStyles({ size: "sm" })}>
      <Plus aria-hidden className="size-4" />
      {t("newProject")}
    </Link>
  );
}

export default async function ProjectsPage() {
  const t = await getTranslations("Projects");
  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-fg">{t("title")}</h1>
        <Suspense fallback={null}>
          <NewProjectButton />
        </Suspense>
      </div>
      <Suspense fallback={<FormSkeleton fields={3} />}>
        <ProjectsContent />
      </Suspense>
    </>
  );
}
