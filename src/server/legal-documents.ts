import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseLegalMarkdown, type LegalBlock } from "@/lib/legal-markdown";

/**
 * Rechtstexte, die als Datei unter ./content/legal/<seite>.<sprache>.md liegen
 * (z. B. der Export eines Datenschutz-Generators). Fehlt die Sprachfassung,
 * wird die deutsche verwendet; `locale` gibt an, welche Fassung geliefert wurde.
 * Seiten ohne Datei verwenden weiterhin die Abschnitte aus messages/*.json.
 */
const CONTENT_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "content", "legal");
const FALLBACK_LOCALE = "de";

export type LegalDocument = { locale: string; blocks: LegalBlock[] };

async function read(page: string, locale: string): Promise<string | null> {
  try {
    return await readFile(path.join(/*turbopackIgnore: true*/ CONTENT_DIR, `${page}.${locale}.md`), "utf8");
  } catch {
    return null;
  }
}

/** `page` muss aus LEGAL_PAGES stammen (feste Liste, kein Nutzereingabe-Pfad). */
export async function getLegalDocument(page: string, locale: string): Promise<LegalDocument | null> {
  for (const candidate of locale === FALLBACK_LOCALE ? [locale] : [locale, FALLBACK_LOCALE]) {
    const source = await read(page, candidate);
    if (source) return { locale: candidate, blocks: parseLegalMarkdown(source) };
  }
  return null;
}
