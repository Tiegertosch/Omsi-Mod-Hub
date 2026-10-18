import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { Container } from "@/components/ui/container";
import { Notice, Skeleton } from "@/components/ui/state";
import { localizedAlternates } from "@/lib/metadata";
import { LEGAL_PAGES } from "@/server/route-existence";

type LegalPage = (typeof LEGAL_PAGES)[number];

/**
 * Seiten mit ungeprüften Vorlagentexten: mit Hinweis „Entwurf“ und nicht
 * indexiert. Das Impressum enthält die echten Angaben des Betreibers
 * (übernommen von online-impressum.de).
 */
const DRAFT_PAGES: ReadonlySet<LegalPage> = new Set(["privacy", "terms"]);

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

/** Links stammen aus den eigenen Übersetzungsdateien; trotzdem nur mailto: und https: zulassen. */
const isAllowedHref = (href: string) => href.startsWith("mailto:") || href.startsWith("https://");

/** Liest `params` hinter <Suspense>, damit die Navigation sofort die Seitenhülle zeigt. */
async function LegalContent({ params }: Pick<Props, "params">) {
  const { page } = await params;
  if (!isLegalPage(page)) notFound();
  const t = await getTranslations("Legal");
  const sections = t.raw(`${page}.sections`) as LegalSection[];

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">{t(`${page}.title`)}</h1>
      {DRAFT_PAGES.has(page) ? (
        <Notice title={t("draftTitle")} className="mt-6">
          {t("draftText")}
        </Notice>
      ) : null}
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
    </>
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
