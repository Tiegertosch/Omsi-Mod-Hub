import { BadgeCheck, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { CreatorAvatar } from "@/components/creators/creator-card";
import { ProjectGrid, ProjectGridSkeleton } from "@/components/mods/project-grid";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Notice, Skeleton } from "@/components/ui/state";
import { externalHost } from "@/lib/external-url";
import { localizedAlternates, truncateDescription } from "@/lib/metadata";
import { getCreatorByUsername } from "@/server/data/creators";
import { getCreatorProjects } from "@/server/data/projects";

type Props = PageProps<"/[locale]/creators/[username]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ username }, locale] = await Promise.all([params, rootLocale()]);
  const creator = await getCreatorByUsername(username);
  if (!creator) notFound();
  return {
    title: creator.displayName,
    description: creator.bio ? truncateDescription(creator.bio) : undefined,
    alternates: localizedAlternates(locale, `/creators/${creator.username}`),
    robots: creator.isSample ? { index: false, follow: true } : undefined,
    openGraph: { type: "profile", title: creator.displayName },
  };
}

async function CreatorProfile({ params }: Pick<Props, "params">) {
  const { username } = await params;
  const creator = await getCreatorByUsername(username);
  if (!creator) notFound();

  const [t, common, format, locale] = await Promise.all([
    getTranslations("Creators"),
    getTranslations("Common"),
    getFormatter(),
    getLocale(),
  ]);
  const projects = await getCreatorProjects(creator.id, locale);
  const websiteHost = creator.websiteUrl ? externalHost(creator.websiteUrl) : null;

  return (
    <>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <CreatorAvatar name={creator.displayName} className="size-20 text-3xl" />
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            {creator.displayName}
            {creator.verified ? <BadgeCheck aria-label={common("verified")} className="size-6 text-info" /> : null}
          </h1>
          <p className="mt-1 text-sm text-subtle">@{creator.username}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge>{t("projects", { count: creator.projectCount })}</Badge>
            {creator.isSample ? <Badge tone="warning">{common("sample")}</Badge> : null}
            <span>{t("memberSince", { date: format.dateTime(creator.createdAt, { month: "long", year: "numeric" }) })}</span>
            {creator.websiteUrl && websiteHost ? (
              <a
                href={creator.websiteUrl}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className="inline-flex items-center gap-1 text-accent hover:text-accent-hover"
              >
                {websiteHost}
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            ) : null}
          </div>
          {creator.bio ? <p className="mt-4 max-w-3xl whitespace-pre-line text-fg/90">{creator.bio}</p> : null}
        </div>
      </header>

      {creator.isSample ? (
        <Notice title={common("sample")} className="mt-8">
          {common("sampleHint")}
        </Notice>
      ) : null}

      <section aria-labelledby="creator-projects" className="mt-12">
        <h2 id="creator-projects" className="mb-6 text-2xl font-semibold text-fg">
          {t("projectsTitle")}
        </h2>
        {projects.length > 0 ? <ProjectGrid projects={projects} priorityCount={3} /> : <p className="text-muted">{t("noProjects")}</p>}
      </section>
    </>
  );
}

export default function CreatorPage({ params }: Props) {
  return (
    <Container className="py-10">
      <Suspense
        fallback={
          <div aria-busy="true">
            <div className="flex gap-6">
              <Skeleton className="size-20 rounded-xl" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-9 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </div>
            <div className="mt-12">
              <ProjectGridSkeleton count={3} />
            </div>
          </div>
        }
      >
        <CreatorProfile params={params} />
      </Suspense>
    </Container>
  );
}
