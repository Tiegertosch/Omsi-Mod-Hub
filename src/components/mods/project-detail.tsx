import { BadgeCheck, ChevronRight, Info, MousePointerClick } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Notice } from "@/components/ui/state";
import { Link } from "@/i18n/navigation";
import { externalHost, isSafeImageSrc } from "@/lib/external-url";
import { pickTranslation } from "@/lib/translation";
import type { ProjectCard, ProjectDetail } from "@/server/data/projects";
import { toTagView } from "@/server/data/tags";

import { ExternalLinkList } from "./external-links";
import { MediaCarousel, type CarouselSlide } from "./media-carousel";
import { ProjectCover } from "./project-cover";
import { ProjectGrid } from "./project-grid";
import { ReportForm } from "./report-form";

/** Gibt Nutzertext sicher als Absätze aus (kein HTML, React escaped den Inhalt). */
function TextBlock({ text, lang }: { text: string; lang: string }) {
  return (
    <div lang={lang} className="space-y-3 text-[0.95rem] leading-relaxed text-fg/90">
      {text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph, index) => (
          <p key={index} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-border pt-8">
      <h2 id={id} className="mb-4 text-xl font-semibold text-fg">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Eine Zeile im Details-Kasten; lange Werte (stacked) stehen unter der Bezeichnung. */
function Fact({ label, children, stacked }: { label: string; children: ReactNode; stacked?: boolean }) {
  return (
    <div
      className={
        stacked
          ? "flex flex-col gap-1 border-b border-border py-3 last:border-b-0"
          : "flex flex-col gap-0.5 border-b border-border py-3 last:border-b-0 sm:flex-row sm:justify-between sm:gap-4"
      }
    >
      <dt className="text-sm text-subtle">{label}</dt>
      <dd className={stacked ? "text-sm text-fg" : "text-sm text-fg sm:text-right"}>{children}</dd>
    </div>
  );
}

export async function ProjectDetailView({
  project,
  locale,
  moreFromCreator,
  preview = false,
}: {
  project: ProjectDetail;
  locale: string;
  moreFromCreator: ProjectCard[];
  /** Vorschau nicht veröffentlichter Projekte: ohne Meldeformular und ohne klickbare Downloads */
  preview?: boolean;
}) {
  const [t, common, link, nav, format] = await Promise.all([
    getTranslations("Project"),
    getTranslations("Common"),
    getTranslations("ExternalLink"),
    getTranslations("Nav"),
    getFormatter(),
  ]);

  const picked = pickTranslation(project.translations, locale, project.defaultLocale);
  const text = picked?.translation;
  const contentLang = text?.locale ?? project.defaultLocale;
  const title = text?.title ?? project.slug;
  const categoryName = pickTranslation(project.category.translations, locale, "en")?.translation.name ?? project.category.slug;
  const creatorName = project.creator.creatorProfile?.displayName ?? project.creator.username;
  const currentVersion = project.versions[0] ?? null;
  const sourceHost = project.sourceUrl ? externalHost(project.sourceUrl) : null;
  const formatDate = (date: Date) => format.dateTime(date, { dateStyle: "long" });
  // Titelbild zuerst, dann die Screenshots; Vorschaukarten zeigen weiterhin nur das Titelbild.
  const slides: CarouselSlide[] = [
    ...(isSafeImageSrc(project.coverImageUrl)
      ? [{ key: "cover", src: project.coverImageUrl, alt: project.coverImageAlt ?? title }]
      : []),
    ...project.screenshots
      .filter((shot) => isSafeImageSrc(shot.imageUrl))
      .map((shot) => ({ key: shot.id, src: shot.imageUrl, alt: shot.altText })),
  ];

  return (
    <article>
      <Container className="py-8">
        <nav aria-label={t("breadcrumb")} className="mb-6">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-subtle">
            <li>
              <Link href="/mods" className="hover:text-fg">
                {nav("mods")}
              </Link>
            </li>
            <li aria-hidden>
              <ChevronRight className="size-3.5" />
            </li>
            <li>
              <Link href={`/mods/${project.category.slug}`} className="hover:text-fg">
                {categoryName}
              </Link>
            </li>
            <li aria-hidden>
              <ChevronRight className="size-3.5" />
            </li>
            <li aria-current="page" className="truncate text-muted">
              {title}
            </li>
          </ol>
        </nav>

        <header className="mb-8">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone="accent">{categoryName}</Badge>
            {project.isSample ? <Badge tone="warning">{common("sample")}</Badge> : null}
          </div>
          <h1 lang={contentLang} className="text-3xl font-bold tracking-tight text-fg sm:text-5xl">
            {title}
          </h1>
          {text?.summary ? (
            <p lang={contentLang} className="mt-3 max-w-3xl text-lg text-muted">
              {text.summary}
            </p>
          ) : null}
          <p className="mt-4 flex items-center gap-1.5 text-sm text-muted">
            {t("by")}
            <Link href={`/creators/${project.creator.username}`} className="font-medium text-fg hover:text-accent">
              {creatorName}
            </Link>
            {project.creator.creatorProfile?.verification === "VERIFIED" ? (
              <BadgeCheck aria-label={common("verified")} className="size-4 text-info" />
            ) : null}
          </p>
        </header>

        {project.isSample ? (
          <Notice title={common("sample")} className="mb-6">
            {common("sampleHint")}
          </Notice>
        ) : null}
        {picked?.isFallback ? (
          <Notice tone="info" className="mb-6">
            {t("fallbackNotice")}
          </Notice>
        ) : null}

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-8">
            {slides.length > 0 ? (
              <MediaCarousel
                slides={slides}
                sizes="(min-width: 1024px) 860px, 100vw"
                labels={{
                  carousel: t("carousel"),
                  media: t("media"),
                  slide: t("slide"),
                  previous: t("previousImage"),
                  next: t("nextImage"),
                  thumbnails: t("thumbnails"),
                  slideOf: slides.map((_, index) => t("slideOf", { index: index + 1, total: slides.length })),
                  show: slides.map((_, index) => t("showImage", { index: index + 1, total: slides.length })),
                }}
              />
            ) : (
              <ProjectCover
                src={null}
                alt={title}
                sizes="(min-width: 1024px) 860px, 100vw"
                className="rounded-[var(--radius-card)] border border-border"
              />
            )}

            {text?.description ? (
              <Section id="description" title={t("description")}>
                <TextBlock text={text.description} lang={contentLang} />
              </Section>
            ) : null}

            {text?.requirements ? (
              <Section id="requirements" title={t("requirements")}>
                <TextBlock text={text.requirements} lang={contentLang} />
              </Section>
            ) : null}

            {text?.installation ? (
              <Section id="installation" title={t("installation")}>
                <TextBlock text={text.installation} lang={contentLang} />
              </Section>
            ) : null}

            {project.versions.length > 0 ? (
              <Section id="changelog" title={t("changelog")}>
                <ol className="space-y-6">
                  {project.versions.map((version) => (
                    <li key={version.id} className="relative border-l-2 border-border pl-5">
                      <span aria-hidden className="absolute top-1.5 -left-[5px] size-2 rounded-full bg-accent" />
                      <h3 className="font-semibold text-fg">
                        {common("version", { version: version.version })}
                        <time dateTime={version.releasedAt.toISOString()} className="ml-3 text-sm font-normal text-subtle">
                          {formatDate(version.releasedAt)}
                        </time>
                      </h3>
                      {version.changelog ? (
                        <div className="mt-2">
                          <TextBlock text={version.changelog} lang={project.defaultLocale} />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </Section>
            ) : null}
          </div>

          {/* Mobil steht der Download direkt unter dem Titel, auf großen Bildschirmen rechts. */}
          <aside className="order-first space-y-6 lg:sticky lg:top-24 lg:order-none lg:self-start">
            <section aria-labelledby="download" className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-card">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 id="download" className="text-lg font-semibold text-fg">
                  {t("downloadTitle")}
                </h2>
                {currentVersion ? <Badge>v{currentVersion.version}</Badge> : null}
              </div>
              {currentVersion && currentVersion.links.length > 0 ? (
                <ExternalLinkList links={currentVersion.links} preview={preview} />
              ) : (
                <p className="text-sm text-muted">{t("noLinks")}</p>
              )}
              <p className="mt-4 flex gap-2 text-xs text-subtle">
                <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                {t("downloadIntro")}
              </p>
              <p className="mt-3 flex gap-2 text-xs text-subtle" title={t("outboundClicksHint")}>
                <MousePointerClick aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {t("outboundClicks", { count: project.outboundClickCount })}
                  <span className="sr-only"> – {t("outboundClicksHint")}</span>
                </span>
              </p>
            </section>

            <section aria-labelledby="details" className="rounded-[var(--radius-card)] border border-border bg-surface px-5 py-2">
              <h2 id="details" className="sr-only">
                {t("details")}
              </h2>
              <dl>
                <Fact label={t("currentVersion")}>{currentVersion?.version ?? t("notSpecified")}</Fact>
                {project.publishedAt ? (
                  <Fact label={t("published")}>
                    <time dateTime={project.publishedAt.toISOString()}>{formatDate(project.publishedAt)}</time>
                  </Fact>
                ) : null}
                {project.lastReleaseAt ? (
                  <Fact label={t("updated")}>
                    <time dateTime={project.lastReleaseAt.toISOString()}>{formatDate(project.lastReleaseAt)}</time>
                  </Fact>
                ) : null}
                <Fact label={t("compatibility")}>{project.gameCompatibility ?? t("notSpecified")}</Fact>
                <Fact label={t("license")} stacked>
                  {project.license}
                </Fact>
                <Fact label={t("sourcePage")}>
                  {project.sourceUrl && sourceHost ? (
                    <a
                      href={project.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-accent hover:text-accent-hover"
                    >
                      {sourceHost}
                      <span className="sr-only"> {link("opensInNewTab")}</span>
                    </a>
                  ) : (
                    t("notSpecified")
                  )}
                </Fact>
                {project.contributors.length > 0 ? (
                  <Fact label={t("contributors")} stacked>
                    <ul className="space-y-0.5">
                      {project.contributors.map((contributor) => (
                        <li key={contributor.id}>
                          {contributor.name}
                          {contributor.role ? <span className="text-subtle"> · {contributor.role}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </Fact>
                ) : null}
              </dl>
            </section>

            {project.tags.length > 0 ? (
              <section aria-labelledby="tags">
                <h2 id="tags" className="mb-2 text-sm font-semibold text-fg">
                  {t("tags")}
                </h2>
                <ul className="flex flex-wrap gap-1.5">
                  {project.tags.map(({ tag: raw }) => toTagView(raw, locale)).map((tag) => (
                    <li key={tag.slug}>
                      <Link
                        href={{ pathname: "/mods", query: { tag: tag.slug } }}
                        className="inline-flex h-7 items-center rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-muted hover:border-border-strong hover:text-fg"
                      >
                        {tag.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {preview ? null : <ReportForm projectId={project.id} />}
          </aside>
        </div>

        {moreFromCreator.length > 0 ? (
          <section aria-labelledby="more" className="mt-20">
            <h2 id="more" className="mb-6 text-2xl font-semibold text-fg">
              {t("moreFromCreator", { name: creatorName })}
            </h2>
            <ProjectGrid projects={moreFromCreator} />
          </section>
        ) : null}
      </Container>
    </article>
  );
}
