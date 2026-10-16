import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/state";
import { Link } from "@/i18n/navigation";
import type { CategorySummary } from "@/server/data/categories";

import { categoryIcon } from "./category-icon";

export function CategoryTiles({ categories }: { categories: CategorySummary[] }) {
  const t = useTranslations("Categories");
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((category) => {
        const Icon = categoryIcon(category.icon);
        return (
          <li key={category.id}>
            <Link
              href={`/mods/${category.slug}`}
              className="group flex h-full flex-col rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors hover:border-accent/50 hover:bg-surface-2"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="mt-4 font-display text-base font-semibold text-fg group-hover:text-accent">
                {category.name}
              </span>
              <span className="mt-0.5 text-xs text-subtle">{t("projectCount", { count: category.projectCount })}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function CategoryTilesSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="mt-4 h-5 w-2/3" />
          <Skeleton className="mt-1.5 h-3 w-1/2" />
        </li>
      ))}
    </ul>
  );
}
