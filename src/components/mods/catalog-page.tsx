import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import type { CatalogParams } from "@/lib/catalog-params";
import type { CategorySummary } from "@/server/data/categories";

import { CatalogResults, CatalogSkeleton, CategoryNav } from "./catalog-view";

export async function CatalogHeader({ category }: { category: CategorySummary | null }) {
  const t = await getTranslations("Catalog");
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">{category?.name ?? t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted">{category?.description ?? t("description")}</p>
    </header>
  );
}

/** Kategorienavigation und Ergebnisse für /mods und /mods/[kategorie]. */
export function CatalogBody({
  categories,
  category,
  params,
}: {
  categories: CategorySummary[];
  category: CategorySummary | null;
  params: CatalogParams;
}) {
  const pathname = category ? `/mods/${category.slug}` : "/mods";
  return (
    <>
      <div className="mb-6">
        <CategoryNav categories={categories} activeSlug={category?.slug ?? null} params={params} />
      </div>
      <Suspense fallback={<CatalogSkeleton withCategories={false} />}>
        <CatalogResults params={params} pathname={pathname} categoryId={category?.id} />
      </Suspense>
    </>
  );
}
