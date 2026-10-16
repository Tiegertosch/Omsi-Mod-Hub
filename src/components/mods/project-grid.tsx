import { Skeleton } from "@/components/ui/state";
import type { ProjectCard as ProjectCardData } from "@/server/data/projects";

import { ProjectCard } from "./project-card";

export function ProjectGrid({ projects, priorityCount = 0 }: { projects: ProjectCardData[]; priorityCount?: number }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project, index) => (
        <li key={project.id} className="flex">
          <div className="flex w-full">
            <ProjectCard project={project} priority={index < priorityCount} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProjectGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          <Skeleton className="aspect-video rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}
