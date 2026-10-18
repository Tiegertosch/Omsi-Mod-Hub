import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { Container } from "@/components/ui/container";
import { Notice, Skeleton } from "@/components/ui/state";
import { type LegalBlock, type LegalInline } from "@/lib/legal-markdown";
import { localizedAlternates } from "@/lib/metadata";
import { getLegalDocument } from "@/server/legal-documents";
import { LEGAL_PAGES } from "@/server/route-existence";

type LegalPage = (typeof LEGAL_PAGES)[number];

/**
 * Seiten mit ungeprüften Vorlagentexten: mit Hinweis „Entwurf“ und nicht
 * indexiert. Impressum (Angaben von online-impressum.de) und Datenschutz-
 * erklärung (Generator von WBS Legal, content/legal/privacy.de.md) sind echt;
 * die Nutzungsbedingungen (content/legal/terms.*.md) sind noch nicht geprüft.
 */
const DRAFT_PAGES: ReadonlySet<LegalPage> = new Set(["terms"]);

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
    // Entwürfe nicht indexieren, bis die Inhalte geprüft sind.
    robots: DRAFT_PAGES.has(page) ? { index: false, follow: true } : undefined,
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
        ) : (
          <p key={index}>
            <Inline content={block.content} />
          </p>
        ),
      )}
    </div>
  );
}

/** Liest `params` hinter <Suspense>, damit die Navigation sofort die Seitenhülle zeigt. */
async function LegalContent({ params }: Pick<Props, "params">) {
  const [{ page }, locale] = await Promise.all([params, rootLocale()]);
  if (!isLegalPage(page)) notFound();
  const [t, document] = await Promise.all([getTranslations("Legal"), getLegalDocument(page, locale)]);

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">{t(`${page}.title`)}</h1>
      {DRAFT_PAGES.has(page) ? (
        <Notice title={t("draftTitle")} className="mt-6">
          {t("draftText")}
        </Notice>
      ) : null}
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

export default function LegalPageView({ params }: Props) {
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
        <LegalContent params={params} />
      </Suspense>
    </Container>
  );
}
