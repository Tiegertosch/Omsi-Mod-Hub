import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { CatalogBody, CatalogHeader } from "@/components/mods/catalog-page";
import { CatalogSkeleton } from "@/components/mods/catalog-view";
import { ProjectDetailView } from "@/components/mods/project-detail";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/state";
import { parseCatalogParams } from "@/lib/catalog-params";
import { isSafeImageSrc } from "@/lib/external-url";
import { localizedAlternates, truncateDescription } from "@/lib/metadata";
import { richTextToPlain } from "@/lib/rich-text";
import { pickTranslation } from "@/lib/translation";
import { getCategories, type CategorySummary } from "@/server/data/categories";
import { getCreatorProjects, getPublishedProject } from "@/server/data/projects";

type Props = PageProps<"/[locale]/mods/[slug]">;

/**
 * /mods/[slug] bedient sowohl Kategorien (z. B. /mods/busse) als auch Projekte.
 * Kategorie-Slugs haben Vorrang; Projekt-Slugs dürfen daher nie einem
 * Kategorie-Slug entsprechen (wird beim Anlegen von Projekten geprüft).
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, rootLocale()]);
  const path = `/mods/${slug}`;

  const category = (await getCategories(locale)).find((c) => c.slug === slug);
  if (category) {
    const t = await getTranslations("Catalog");
    return {
      title: category.name,
      description: category.description ?? t("categoryDescription", { category: category.name }),
      alternates: localizedAlternates(locale, path),
    };
  }

  const project = await getPublishedProject(slug);
  if (!project) notFound();

  const text = pickTranslation(project.translations, locale, project.defaultLocale)?.translation;
  const title = text?.title ?? project.slug;
  const description = truncateDescription(text?.summary || richTextToPlain(text?.description ?? ""));
  const image = isSafeImageSrc(project.coverImageUrl) ? project.coverImageUrl : undefined;

  return {
    title,
    description,
    alternates: localizedAlternates(locale, path),
    // Beispieldaten sollen nicht in Suchmaschinen landen.
    robots: project.isSample ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: project.publishedAt?.toISOString(),
      modifiedTime: (project.lastReleaseAt ?? project.updatedAt).toISOString(),
      images: image ? [{ url: image, alt: project.coverImageAlt ?? title }] : undefined,
    },
  };
}

async function CategoryCatalog({
  categories,
  category,
  searchParams,
}: {
  categories: CategorySummary[];
  category: CategorySummary;
  searchParams: Props["searchParams"];
}) {
  const params = parseCatalogParams(await searchParams);
  return <CatalogBody categories={categories} category={category} params={params} />;
}

/**
 * Hinweis zum Status-Code: Unbekannte Slugs beantwortet bereits der Proxy mit
 * einem echten 404 (src/server/route-existence.ts). Das notFound() hier greift
 * nur, wenn sich der Zustand zwischen Proxy und Rendern ändert; dann bleibt es
 * bei der gestreamten 404-Seite mit `noindex` und Status 200.
 */
async function SlugContent({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const categories = await getCategories(locale);
  const category = categories.find((c) => c.slug === slug);

  if (category) {
    return (
      <Container className="py-10">
        <CatalogHeader category={category} />
        <Suspense fallback={<CatalogSkeleton />}>
          <CategoryCatalog categories={categories} category={category} searchParams={searchParams} />
        </Suspense>
      </Container>
    );
  }

  const project = await getPublishedProject(slug);
  if (!project) notFound();

  const moreFromCreator = await getCreatorProjects(project.creator.id, locale, { excludeId: project.id, take: 3 });
  return <ProjectDetailView project={project} locale={locale} moreFromCreator={moreFromCreator} />;
}

function SlugSkeleton() {
  return (
    <Container className="py-10" aria-busy="true">
      <Skeleton className="mb-3 h-6 w-28" />
      <Skeleton className="mb-3 h-10 w-2/3" />
      <Skeleton className="mb-10 h-5 w-1/2" />
      <CatalogSkeleton withCategories={false} />
    </Container>
  );
}

export default function ModSlugPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<SlugSkeleton />}>
      <SlugContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
