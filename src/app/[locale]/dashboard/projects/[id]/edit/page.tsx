import { ArrowLeft, ExternalLink, Eye } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense, type ReactNode } from "react";

import { FormSkeleton } from "@/components/auth/auth-shell";
import { MediaManager } from "@/components/editor/media-manager";
import { ProjectForm } from "@/components/editor/project-form";
import { StatusPanel } from "@/components/editor/status-panel";
import { VersionManager } from "@/components/editor/version-manager";
import { buttonStyles } from "@/components/ui/button";
import { Notice } from "@/components/ui/state";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { isSafeImageSrc } from "@/lib/external-url";
import { isReviewRequired } from "@/lib/project-rules";
import { availableCreatorActions, isEditableByCreator, publishChecklist } from "@/lib/project-status";
import { pickTranslation } from "@/lib/translation";
import { requireCreator } from "@/server/creator";
import { getEditorOptions, getOwnProjectForEditor } from "@/server/data/creator-projects";

type Props = PageProps<"/[locale]/dashboard/projects/[id]/edit">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Editor");
  return { title: t("editTitle"), robots: { index: false, follow: false } };
}

function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-[var(--radius-card)] border border-border bg-surface p-5 sm:p-6">
      <h2 id={id} className="mb-5 text-lg font-semibold text-fg">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function EditorContent({ params }: Pick<Props, "params">) {
  const [{ id }, locale] = await Promise.all([params, rootLocale()]);
  const user = await requireCreator(locale, `/${locale}/dashboard/projects/${id}/edit`);
  const project = await getOwnProjectForEditor(user, id);
  if (!project) notFound();

  const [t, projectsT, options] = await Promise.all([
    getTranslations("Editor"),
    getTranslations("Projects"),
    getEditorOptions(locale),
  ]);
  const reviewRequired = isReviewRequired();
  const editable = isEditableByCreator(project.status);
  const title = pickTranslation(project.translations, locale, project.defaultLocale)?.translation.title ?? project.slug;
  const checklist = publishChecklist(project);
  const defaultLocale = hasLocale(routing.locales, project.defaultLocale) ? project.defaultLocale : routing.defaultLocale;

  const translations = Object.fromEntries(
    routing.locales.map((l) => {
      const tr = project.translations.find((x) => x.locale === l);
      return [
        l,
        {
          title: tr?.title ?? "",
          summary: tr?.summary ?? "",
          description: tr?.description ?? "",
          installation: tr?.installation ?? "",
        },
      ];
    }),
  ) as Record<(typeof routing.locales)[number], { title: string; summary: string; description: string; installation: string }>;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-subtle">{t("editTitle")}</p>
          <h1 className="truncate text-3xl font-bold tracking-tight text-fg">{title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/projects/${project.id}/preview`} className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <Eye aria-hidden className="size-4" />
            {projectsT("preview")}
          </Link>
          {project.status === "PUBLISHED" ? (
            <Link href={`/mods/${project.slug}`} className={buttonStyles({ variant: "ghost", size: "sm" })}>
              <ExternalLink aria-hidden className="size-4" />
              {projectsT("viewPublic")}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {!editable ? <Notice>{t("lockedNotice")}</Notice> : null}
          {editable && project.status === "PUBLISHED" ? <Notice tone="info">{t("publishedEditNotice")}</Notice> : null}

          {editable ? (
            <>
              <ProjectForm
                options={options}
                values={{
                  projectId: project.id,
                  categoryId: project.categoryId,
                  defaultLocale,
                  slug: project.slug,
                  slugLocked: project.publishedAt !== null,
                  license: project.license,
                  sourceUrl: project.sourceUrl ?? "",
                  gameCompatibility: project.gameCompatibility ?? "",
                  translations,
                  tags: project.tags.map(({ tag }) => tag.slug),
                  contributors: project.contributors.map((c) => ({ name: c.name, role: c.role ?? "" })),
                  requirements: project.requirements.map((r) => ({ name: r.name, url: r.url ?? "", pricing: r.pricing })),
                }}
              />
              <Panel id="section-media" title={t("sections.media")}>
                <MediaManager
                  projectId={project.id}
                  cover={
                    isSafeImageSrc(project.coverImageUrl)
                      ? { url: project.coverImageUrl, alt: project.coverImageAlt ?? title }
                      : null
                  }
                  screenshots={project.screenshots
                    .filter((s) => isSafeImageSrc(s.imageUrl))
                    .map((s) => ({ id: s.id, url: s.imageUrl, alt: s.altText }))}
                />
              </Panel>
              <Panel id="section-versions" title={t("sections.versions")}>
                <VersionManager
                  projectId={project.id}
                  versions={project.versions.map((v) => ({
                    id: v.id,
                    version: v.version,
                    changelog: v.changelog ?? "",
                    releasedAt: v.releasedAt,
                    links: v.links.map((l) => ({ id: l.id, url: l.url, label: l.label ?? "", sourceType: l.sourceType })),
                  }))}
                />
              </Panel>
            </>
          ) : null}
        </div>

        <aside className="order-first xl:order-none">
          <div className="xl:sticky xl:top-24">
            <Panel id="section-status" title={t("sections.status")}>
              <StatusPanel
                projectId={project.id}
                status={project.status}
                moderationNote={project.moderationNote}
                checklist={checklist.items}
                actions={availableCreatorActions(project.status, { reviewRequired })}
                reviewRequired={reviewRequired}
              />
            </Panel>
          </div>
        </aside>
      </div>
    </>
  );
}

export default async function EditProjectPage({ params }: Props) {
  const t = await getTranslations("Editor");
  return (
    <>
      <Link href="/dashboard/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft aria-hidden className="size-4" />
        {t("backToList")}
      </Link>
      <Suspense fallback={<FormSkeleton fields={6} />}>
        <EditorContent params={params} />
      </Suspense>
    </>
  );
}
