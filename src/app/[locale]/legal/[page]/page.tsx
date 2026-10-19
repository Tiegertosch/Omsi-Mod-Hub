import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { connection } from "next/server";
import { Suspense } from "react";

import { Container } from "@/components/ui/container";
import { Notice, Skeleton } from "@/components/ui/state";
import { Link } from "@/i18n/navigation";
import { berlinDate, findTermsVersion, termsInForce, upcomingTerms, type TermsVersion } from "@/lib/legal";
import { type LegalBlock, type LegalInline } from "@/lib/legal-markdown";
import { localizedAlternates } from "@/lib/metadata";
import { getLegalDocument, getTermsDocument } from "@/server/legal-documents";
import { LEGAL_PAGES } from "@/server/route-existence";

type LegalPage = (typeof LEGAL_PAGES)[number];

type Props = PageProps<"/[locale]/legal/[page]">;

function isLegalPage(value: string): value is LegalPage {
  return (LEGAL_PAGES as readonly string[]).includes(value);
}

export function generateStaticParams() {
  return LEGAL_PAGES.map((page) => ({ page }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ page }, locale] = await Promise.all([params, rootLocale()]);
  if (!isLegalPage(page)) notFound();
  const t = await getTranslations("Legal");
  return {
    title: t(`${page}.title`),
    alternates: localizedAlternates(locale, `/legal/${page}`),
  };
}

type LegalLink = { label: string; href: string };
type LegalSection = { heading: string; body: string; links?: LegalLink[] };

/** Links stammen aus den eigenen Übersetzungsdateien; trotzdem nur tel:, mailto: und https: zulassen. */
const isAllowedHref = (href: string) => /^(tel:|mailto:|https:\/\/)/.test(href);

function Inline({ content }: { content: LegalInline[] }) {
  return content.map((part, index) =>
    part.type === "link" ? (
      <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">
        {part.text}
      </a>
    ) : part.type === "strong" ? (
      <strong key={index} className="font-semibold text-fg">
        {part.text}
      </strong>
    ) : part.type === "code" ? (
      <code key={index} className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[0.85em] [overflow-wrap:anywhere] text-fg">
        {part.text}
      </code>
    ) : (
      part.text
    ),
  );
}

/** Rechtstext aus content/legal/*.md (siehe src/server/legal-documents.ts). */
function LegalDocumentView({ blocks, lang }: { blocks: LegalBlock[]; lang: string }) {
  return (
    <div lang={lang} className="mt-10 space-y-4 leading-relaxed text-fg/85">
      {blocks.map((block, index) =>
        block.type === "heading" ? (
          block.level === 2 ? (
            <h2 key={index} className="pt-6 text-xl font-semibold text-fg">
              {block.text}
            </h2>
          ) : (
            <h3 key={index} className="pt-2 font-semibold text-fg">
              {block.text}
            </h3>
          )
        ) : block.type === "list" ? (
          <ul key={index} className="list-disc space-y-2 pl-6">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Inline content={item} />
              </li>
            ))}
          </ul>
        ) : block.type === "table" ? (
          // Auf schmalen Bildschirmen scrollt nur die Tabelle, nicht die Seite.
          <div key={index} className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead>
                <tr>
                  {block.header.map((cell, cellIndex) => (
                    <th key={cellIndex} scope="col" className="border-b border-border-strong px-3 py-2 font-semibold text-fg">
                      <Inline content={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="border-b border-border px-3 py-2 align-top">
                        <Inline content={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p key={index}>
            <Inline content={block.content} />
          </p>
        ),
      )}
    </div>
  );
}

type TermsSelection = { shown: TermsVersion; inForce: TermsVersion; upcoming: TermsVersion | null; today: string };

/** Welche Fassung der Nutzungsbedingungen angezeigt wird: die geltende oder per ?fassung=… eine andere. */
async function selectTerms(searchParams: Props["searchParams"]): Promise<TermsSelection> {
  const { fassung } = await searchParams;
  // Welche Fassung gilt, hängt vom heutigen Datum ab – nicht vorab rendern.
  await connection();
  const now = new Date();
  const inForce = termsInForce(now);
  const requested = typeof fassung === "string" ? findTermsVersion(fassung) : null;
  return { shown: requested ?? inForce, inForce, upcoming: upcomingTerms(now), today: berlinDate(now) };
}

async function TermsVersionNotice({ terms }: { terms: TermsSelection }) {
  const [t, format] = await Promise.all([getTranslations("Legal"), getFormatter()]);
  const date = (value: string) => format.dateTime(new Date(`${value}T12:00:00Z`), { dateStyle: "long" });
  const link = (href: string, label: string) => (
    <Link href={href} className="font-medium text-accent hover:text-accent-hover">
      {label}
    </Link>
  );

  if (terms.shown.version === terms.inForce.version) {
    if (!terms.upcoming) return null;
    return (
      <Notice tone="info" className="mt-6">
        {t("termsUpcoming", { date: date(terms.upcoming.effectiveFrom) })}{" "}
        {link(`/legal/terms?fassung=${terms.upcoming.version}`, t("termsReadUpcoming"))}
      </Notice>
    );
  }
  return (
    <Notice tone="info" className="mt-6">
      {terms.shown.effectiveFrom > terms.today
        ? t("termsShownUpcoming", { date: date(terms.shown.effectiveFrom) })
        : t("termsShownOutdated")}{" "}
      {link("/legal/terms", t("termsReadCurrent"))}
    </Notice>
  );
}

/** Liest `params` hinter <Suspense>, damit die Navigation sofort die Seitenhülle zeigt. */
async function LegalContent({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ page }, locale] = await Promise.all([params, rootLocale()]);
  if (!isLegalPage(page)) notFound();
  const terms = page === "terms" ? await selectTerms(searchParams) : null;
  const [t, document] = await Promise.all([
    getTranslations("Legal"),
    terms ? getTermsDocument(terms.shown.version, locale) : getLegalDocument(page, locale),
  ]);

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">{t(`${page}.title`)}</h1>
      {terms ? <TermsVersionNotice terms={terms} /> : null}
      {document && document.locale !== locale ? (
        <Notice tone="info" className="mt-6">
          {t("languageFallback")}
        </Notice>
      ) : null}
      {document ? (
        <LegalDocumentView blocks={document.blocks} lang={document.locale} />
      ) : page === "imprint" ? (
        <LegalSections sections={t.raw(`${page}.sections`) as LegalSection[]} />
      ) : (
        // Datenschutz und Nutzungsbedingungen gibt es nur als Datei; fehlt sie, ist das ein Deploy-Fehler.
        notFound()
      )}
    </>
  );
}

/** Abschnitte aus messages/*.json (Seiten ohne Datei unter content/legal). */
function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="mt-10 space-y-8">
      {sections.map((section) => (
        <section key={section.heading}>
          <h2 className="text-xl font-semibold text-fg">{section.heading}</h2>
          <p className="mt-2 whitespace-pre-line text-fg/85">{section.body}</p>
          {section.links?.length ? (
            <ul className="mt-2 space-y-1">
              {section.links
                .filter((link) => isAllowedHref(link.href))
                .map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      {...(link.href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="font-medium text-accent hover:text-accent-hover"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

export default function LegalPageView({ params, searchParams }: Props) {
  return (
    <Container className="max-w-3xl py-12">
      <Suspense
        fallback={
          <div aria-busy="true">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="mt-6 h-20" />
            <Skeleton className="mt-10 h-40" />
          </div>
        }
      >
        <LegalContent params={params} searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
