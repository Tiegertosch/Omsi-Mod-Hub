import { PackageSearch, X } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Form from "next/form";

import { buttonStyles } from "@/components/ui/button";
import { Skeleton, EmptyState } from "@/components/ui/state";
import { getPathname, Link } from "@/i18n/navigation";
import { catalogQuery, CATALOG_SORTS, toggleTag, type CatalogParams } from "@/lib/catalog-params";
import { cn } from "@/lib/utils";
import type { CategorySummary } from "@/server/data/categories";
import { searchProjects } from "@/server/data/projects";
import { getPopularTags, getTagsBySlugs } from "@/server/data/tags";

import { Pagination } from "./pagination";
import { ProjectGrid, ProjectGridSkeleton } from "./project-grid";

const SORT_LABEL_KEYS = {
  newest: "sortNewest",
  updated: "sortUpdated",
  popular: "sortPopular",
} as const;

function pillClass(active: boolean) {
  return cn(
    "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
    active
      ? "border-accent bg-accent-soft text-accent"
      : "border-border bg-surface text-muted hover:border-border-strong hover:text-fg",
  );
}

export async function CategoryNav({
  categories,
  activeSlug,
  params,
}: {
  categories: CategorySummary[];
  activeSlug: string | null;
  params: CatalogParams;
}) {
  const t = await getTranslations("Catalog");
  const query = catalogQuery({ ...params, page: 1 });
  return (
    <nav aria-label={t("filtersLabel")} className="-mx-4 overflow-x-auto px-4 pb-1">
      <ul className="flex w-max gap-2">
        <li>
          <Link href={{ pathname: "/mods", query }} aria-current={activeSlug === null ? "page" : undefined} className={pillClass(activeSlug === null)}>
            {t("allCategories")}
          </Link>
        </li>
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={{ pathname: `/mods/${category.slug}`, query }}
              aria-current={activeSlug === category.slug ? "page" : undefined}
              className={pillClass(activeSlug === category.slug)}
            >
              {category.name}
              <span className="ml-2 text-xs text-subtle">{category.projectCount}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Suchfeld, Sortierung, Tag-Filter, Ergebnisse und Pagination.
 * Alle Zustände liegen in der URL, damit Ergebnisse teilbar sind.
 */
export async function CatalogResults({
  params,
  pathname,
  categoryId,
}: {
  params: CatalogParams;
  /** lokalisierungsfreier Pfad, z. B. "/mods" oder "/mods/busse" */
  pathname: string;
  categoryId?: string;
}) {
  const [t, locale] = await Promise.all([getTranslations("Catalog"), getLocale()]);
  const [result, popularTags, selectedTags] = await Promise.all([
    searchProjects(params, locale, { categoryId }),
    getPopularTags(locale, { categoryId }),
    getTagsBySlugs(params.tags, locale),
  ]);

  const tagName = new Map([...popularTags, ...selectedTags].map((tag) => [tag.slug, tag.name]));
  const visibleTags = popularTags.filter((tag) => !params.tags.includes(tag.slug));
  const hasFilters = params.q.length > 0 || params.tags.length > 0;
  const baseQuery = catalogQuery({ ...params, page: 1 });

  return (
    <div>
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 lg:flex-row lg:items-center">
        <Form action={getPathname({ href: pathname, locale })} role="search" className="flex flex-1 gap-2">
          <label htmlFor="catalog-q" className="sr-only">
            {t("searchLabel")}
          </label>
          <input
            id="catalog-q"
            name="q"
            type="search"
            defaultValue={params.q}
            maxLength={100}
            placeholder={t("searchLabel")}
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-subtle hover:border-border-strong focus:border-accent focus:outline-none"
          />
          {params.tags.map((tag) => (
            <input key={tag} type="hidden" name="tag" value={tag} />
          ))}
          {params.sort !== "newest" ? <input type="hidden" name="sort" value={params.sort} /> : null}
          <button type="submit" className={buttonStyles({ variant: "secondary" })}>
            {t("apply")}
          </button>
        </Form>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-subtle uppercase" id="sort-label">
            {t("sortLabel")}
          </span>
          <ul aria-labelledby="sort-label" className="flex rounded-lg border border-border bg-surface-2 p-0.5">
            {CATALOG_SORTS.map((sort) => {
              const active = params.sort === sort;
              return (
                <li key={sort}>
                  <Link
                    href={{ pathname, query: catalogQuery({ ...params, sort, page: 1 }) }}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "block rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      active ? "bg-surface-3 text-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    {t(SORT_LABEL_KEYS[sort])}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {params.tags.length > 0 || visibleTags.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium tracking-wide text-subtle uppercase">{t("tagsLabel")}</span>
          {params.tags.map((slug) => (
            <Link
              key={slug}
              href={{ pathname, query: catalogQuery({ ...params, tags: toggleTag(params.tags, slug), page: 1 }) }}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-accent/50 bg-accent-soft px-2.5 text-xs font-medium text-accent hover:border-accent"
            >
              {tagName.get(slug) ?? slug}
              <X aria-hidden className="size-3.5" />
              <span className="sr-only">{t("removeTag", { tag: tagName.get(slug) ?? slug })}</span>
            </Link>
          ))}
          {visibleTags.map((tag) => (
            <Link
              key={tag.slug}
              href={{ pathname, query: catalogQuery({ ...params, tags: toggleTag(params.tags, tag.slug), page: 1 }) }}
              className="inline-flex h-7 items-center rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-muted hover:border-border-strong hover:text-fg"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-6 mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-muted" aria-live="polite">
          {t("results", { count: result.total })}
        </p>
        {hasFilters ? (
          <Link
            href={{ pathname, query: catalogQuery({ sort: params.sort }) }}
            className="text-sm font-medium text-accent hover:text-accent-hover"
          >
            {t("resetFilters")}
          </Link>
        ) : null}
      </div>

      {result.items.length > 0 ? (
        <>
          <ProjectGrid projects={result.items} priorityCount={3} />
          <Pagination pathname={pathname} query={baseQuery} page={result.page} pageCount={result.pageCount} />
        </>
      ) : (
        <EmptyState icon={PackageSearch} title={t("emptyTitle")}>
          {t("emptyText")}
        </EmptyState>
      )}
    </div>
  );
}

export function CatalogSkeleton({ withCategories = true }: { withCategories?: boolean }) {
  return (
    <div aria-busy="true">
      {withCategories ? (
        <div className="mb-6 flex gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-24 rounded-full" />
          ))}
        </div>
      ) : null}
      <Skeleton className="mb-8 h-[4.5rem] w-full rounded-[var(--radius-card)]" />
      <ProjectGridSkeleton />
    </div>
  );
}
