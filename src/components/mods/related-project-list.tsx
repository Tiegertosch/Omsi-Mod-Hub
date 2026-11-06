import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { RelatedProject } from "@/server/data/projects";

/**
 * Verweise auf andere Projekte im Hub („Benötigt“ bzw. „Wird benötigt von“).
 * Interne Links, daher ohne Hinweis auf ein externes Ziel.
 */
export async function RelatedProjectList({ projects, label }: { projects: RelatedProject[]; label: string }) {
  const t = await getTranslations("Project");

  return (
    <ul aria-label={label} className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={`/mods/${project.slug}`}
            className="group flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-2"
          >
            <div className="min-w-0">
              <p lang={project.contentLocale} className="font-medium break-words text-fg group-hover:text-accent">
                {project.title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                <Badge tone={project.pricing === "FREEWARE" ? "success" : "warning"}>{t(`pricing.${project.pricing}`)}</Badge>
                <span>
                  {t("by")} {project.creatorName}
                </span>
              </div>
            </div>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle group-hover:text-accent" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
