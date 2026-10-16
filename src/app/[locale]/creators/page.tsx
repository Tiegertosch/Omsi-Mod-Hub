import { Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { CreatorCard } from "@/components/creators/creator-card";
import { Container } from "@/components/ui/container";
import { EmptyState, Skeleton } from "@/components/ui/state";
import { localizedAlternates } from "@/lib/metadata";
import { getCreators } from "@/server/data/creators";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await rootLocale();
  const t = await getTranslations("Creators");
  return { title: t("title"), description: t("description"), alternates: localizedAlternates(locale, "/creators") };
}

async function CreatorList() {
  const [creators, t] = await Promise.all([getCreators(), getTranslations("Creators")]);
  if (creators.length === 0) {
    return (
      <EmptyState icon={Users} title={t("emptyTitle")}>
        {t("emptyText")}
      </EmptyState>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {creators.map((creator) => (
        <li key={creator.id}>
          <CreatorCard creator={creator} />
        </li>
      ))}
    </ul>
  );
}

export default async function CreatorsPage() {
  const t = await getTranslations("Creators");
  return (
    <Container className="py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("description")}</p>
      </header>
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-24 rounded-[var(--radius-card)]" />
            ))}
          </div>
        }
      >
        <CreatorList />
      </Suspense>
    </Container>
  );
}
