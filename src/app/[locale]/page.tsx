import { ArrowRight, PackageOpen } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { CreatorCard } from "@/components/creators/creator-card";
import { SearchForm } from "@/components/layout/search-form";
import { CategoryTiles, CategoryTilesSkeleton } from "@/components/mods/category-tiles";
import { ProjectGrid, ProjectGridSkeleton } from "@/components/mods/project-grid";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/state";
import { Link } from "@/i18n/navigation";
import { localizedAlternates } from "@/lib/metadata";
import { getCategories } from "@/server/data/categories";
import { getCreators } from "@/server/data/creators";
import { getProjectList } from "@/server/data/projects";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await rootLocale();
  const t = await getTranslations("Metadata");
  return {
    title: { absolute: t("defaultTitle") },
    alternates: localizedAlternates(locale, "/"),
    openGraph: { title: t("defaultTitle"), description: t("description") },
  };
}

async function HomeCategories() {
  const categories = await getCategories(await getLocale());
  return <CategoryTiles categories={categories} />;
}

async function HomeProjects() {
  const [t, locale] = await Promise.all([getTranslations("Home"), getLocale()]);
  const [newest, updated, popular] = await Promise.all([
    getProjectList("newest", locale),
    getProjectList("updated", locale),
    getProjectList("popular", locale),
  ]);

  if (newest.length === 0) {
    return (
      <EmptyState icon={PackageOpen} title={t("emptyTitle")}>
        {t("emptyText")}
      </EmptyState>
    );
  }

  const common = await getTranslations("Common");
  const showAll = (sort?: "updated" | "popular") => (
    <Link
      href={{ pathname: "/mods", query: sort ? { sort } : {} }}
      className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
    >
      {common("showAll")}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );

  return (
    <div className="space-y-16">
      <section aria-labelledby="newest">
        <SectionHeading id="newest" title={t("newestTitle")} action={showAll()} />
        <ProjectGrid projects={newest} priorityCount={3} />
      </section>
      <section aria-labelledby="updated">
        <SectionHeading id="updated" title={t("updatedTitle")} action={showAll("updated")} />
        <ProjectGrid projects={updated} />
      </section>
      <section aria-labelledby="popular">
        <SectionHeading
          id="popular"
          title={t("popularTitle")}
          description={t("popularHint")}
          action={popular.length > 0 ? showAll("popular") : undefined}
        />
        {popular.length > 0 ? (
          <ProjectGrid projects={popular} />
        ) : (
          <p className="rounded-[var(--radius-card)] border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted">
            {t("popularEmpty")}
          </p>
        )}
      </section>
    </div>
  );
}

async function HomeCreators() {
  const creators = await getCreators({ take: 4 });
  if (creators.length === 0) return null;
  const t = await getTranslations("Home");
  const common = await getTranslations("Common");
  return (
    <section aria-labelledby="creators" className="mt-16">
      <SectionHeading
        id="creators"
        title={t("creatorsTitle")}
        action={
          <Link
            href="/creators"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
          >
            {common("showAll")}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        }
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {creators.map((creator) => (
          <li key={creator.id}>
            <CreatorCard creator={creator} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,rgb(246_167_35/0.10),transparent),radial-gradient(40rem_20rem_at_0%_110%,rgb(108_178_255/0.06),transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.025)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <Container className="relative py-16 sm:py-24">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase">
            {t("heroEyebrow")}
          </p>
          <h1 className="max-w-3xl text-4xl leading-[1.05] font-bold tracking-tight text-fg sm:text-6xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">{t("heroText")}</p>
          <SearchForm size="lg" id="hero-search" className="mt-8 max-w-2xl" />
        </Container>
      </section>

      <Container className="py-14">
        <section aria-labelledby="categories" className="mb-16">
          <SectionHeading id="categories" title={t("categoriesTitle")} />
          <Suspense fallback={<CategoryTilesSkeleton />}>
            <HomeCategories />
          </Suspense>
        </section>

        <Suspense fallback={<ProjectGridSkeleton />}>
          <HomeProjects />
        </Suspense>

        <Suspense fallback={null}>
          <HomeCreators />
        </Suspense>

        <section
          aria-labelledby="cta"
          className="mt-20 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-2 to-surface p-8 sm:p-12"
        >
          <h2 id="cta" className="text-3xl font-bold tracking-tight text-fg">
            {t("ctaTitle")}
          </h2>
          <p className="mt-3 max-w-2xl text-muted">{t("ctaText")}</p>
          <p className="mt-2 text-sm text-subtle">{t("ctaSoon")}</p>
          <Link href="/mods" className={buttonStyles({ size: "lg", className: "mt-6" })}>
            {t("ctaBrowse")}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </section>
      </Container>
    </>
  );
}
