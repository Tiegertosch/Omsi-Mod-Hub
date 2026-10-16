import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { CatalogBody, CatalogHeader } from "@/components/mods/catalog-page";
import { CatalogSkeleton } from "@/components/mods/catalog-view";
import { Container } from "@/components/ui/container";
import { parseCatalogParams } from "@/lib/catalog-params";
import { localizedAlternates } from "@/lib/metadata";
import { getCategories } from "@/server/data/categories";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await rootLocale();
  const t = await getTranslations("Catalog");
  return {
    title: t("title"),
    description: t("description"),
    alternates: localizedAlternates(locale, "/mods"),
  };
}

async function ModsCatalog({ searchParams }: Pick<PageProps<"/[locale]/mods">, "searchParams">) {
  const [categories, params] = await Promise.all([
    getLocale().then(getCategories),
    searchParams.then(parseCatalogParams),
  ]);
  return <CatalogBody categories={categories} category={null} params={params} />;
}

export default function ModsPage({ searchParams }: PageProps<"/[locale]/mods">) {
  return (
    <Container className="py-10">
      <CatalogHeader category={null} />
      <Suspense fallback={<CatalogSkeleton />}>
        <ModsCatalog searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
