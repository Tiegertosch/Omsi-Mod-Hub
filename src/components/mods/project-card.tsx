import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { ProjectCard as ProjectCardData } from "@/server/data/projects";

import { ProjectCover } from "./project-cover";

export function ProjectCard({ project, priority }: { project: ProjectCardData; priority?: boolean }) {
  const t = useTranslations("Common");
  const format = useFormatter();
  const date = project.lastReleaseAt ?? project.publishedAt;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-card transition-colors hover:border-border-strong">
      <div className="relative">
        <ProjectCover
          src={project.coverImageUrl}
          alt={project.coverImageAlt ?? ""}
          sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
          priority={priority}
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge className="border-black/20 bg-bg/80 text-fg backdrop-blur">{project.categoryName}</Badge>
          {project.pricing === "PAYWARE" ? (
            <Badge tone="warning" className="bg-bg/80 backdrop-blur">
              {t("payware")}
            </Badge>
          ) : null}
          {project.isSample ? (
            <Badge tone="warning" className="bg-bg/80 backdrop-blur">
              {t("sample")}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-lg leading-snug font-semibold text-fg" lang={project.contentLocale}>
          <Link
            href={`/mods/${project.slug}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-focus-within:text-accent"
          >
            {project.title}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted" lang={project.contentLocale}>
          {project.summary}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs text-subtle">
          <span className="font-medium text-muted">{t("byCreator", { name: project.creatorName })}</span>
          {project.latestVersion ? <span>v{project.latestVersion}</span> : null}
          {date ? (
            <time dateTime={date.toISOString()} className="ml-auto">
              {format.dateTime(date, { dateStyle: "medium" })}
            </time>
          ) : null}
        </div>
      </div>
      {/* Fokusrahmen für die ganze Karte, da der Link die Karte überdeckt */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[var(--radius-card)] ring-accent group-has-[:focus-visible]:ring-2"
      />
    </article>
  );
}
