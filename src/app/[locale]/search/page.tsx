import { Search } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { CreatorCard } from "@/components/creators/creator-card";
import { SearchForm } from "@/components/layout/search-form";
import { CatalogResults, CatalogSkeleton } from "@/components/mods/catalog-view";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/state";
import { parseCatalogParams, type CatalogParams } from "@/lib/catalog-params";
import { localizedAlternates } from "@/lib/metadata";
import { getCreators } from "@/server/data/creators";

type Props = PageProps<"/[locale]/search">;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await rootLocale();
  const t = await getTranslations("Search");
  return {
    title: t("pageTitle"),
    alternates: localizedAlternates(locale, "/search"),
    // Suchergebnisseiten nicht indexieren, Links aber verfolgen.
    robots: { index: false, follow: true },
  };
}

async function MatchingCreators({ q }: { q: string }) {
  const creators = await getCreators({ q, take: 6 });
  if (creators.length === 0) return null;
  const t = await getTranslations("Search");
  return (
    <section aria-labelledby="matching-creators" className="mb-10">
      <h2 id="matching-creators" className="mb-4 text-xl font-semibold text-fg">
        {t("creatorsTitle")}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {creators.map((creator) => (
          <li key={creator.id}>
            <CreatorCard creator={creator} />
          </li>
        ))}
      </ul>
    </section>
  );
}

async function SearchResults({ params }: { params: CatalogParams }) {
  const t = await getTranslations("Search");
  if (!params.q && params.tags.length === 0) {
    return (
      <EmptyState icon={Search} title={t("promptTitle")}>
        {t("promptText")}
      </EmptyState>
    );
  }
  return (
    <>
      {params.q ? (
        <Suspense fallback={null}>
          <MatchingCreators q={params.q} />
        </Suspense>
      ) : null}
      <section aria-labelledby="matching-projects">
        <h2 id="matching-projects" className="mb-4 text-xl font-semibold text-fg">
          {t("projectsTitle")}
        </h2>
        <CatalogResults params={params} pathname="/search" />
      </section>
    </>
  );
}

async function SearchPageContent({ searchParams }: Pick<Props, "searchParams">) {
  const params = parseCatalogParams(await searchParams);
  const t = await getTranslations("Search");
  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
          {params.q ? t("resultsTitle", { query: params.q }) : t("pageTitle")}
        </h1>
        <SearchForm id="search-page" size="lg" defaultValue={params.q} className="mt-6 max-w-2xl" />
      </header>
      <Suspense fallback={<CatalogSkeleton withCategories={false} />}>
        <SearchResults params={params} />
      </Suspense>
    </>
  );
}

export default function SearchPage({ searchParams }: Props) {
  return (
    <Container className="py-10">
      <Suspense fallback={<CatalogSkeleton withCategories={false} />}>
        <SearchPageContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
