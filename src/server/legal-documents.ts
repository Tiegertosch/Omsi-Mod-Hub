import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseLegalMarkdown, type LegalBlock } from "@/lib/legal-markdown";

/**
 * Rechtstexte als Dateien unter ./content/legal (z. B. der Export eines
 * Datenschutz-Generators). Fehlt die Sprachfassung, wird die deutsche
 * verwendet; `locale` gibt an, welche Fassung geliefert wurde. Seiten ohne
 * Datei verwenden weiterhin die Abschnitte aus messages/*.json.
 */
const CONTENT_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "content", "legal");
const FALLBACK_LOCALE = "de";

export type LegalDocument = { locale: string; blocks: LegalBlock[] };

async function read(relativePath: string): Promise<string | null> {
  try {
    return await readFile(path.join(/*turbopackIgnore: true*/ CONTENT_DIR, relativePath), "utf8");
  } catch {
    return null;
  }
}

/** `name` ist ein fester Pfad ohne Sprache, z. B. "privacy" oder "terms/2026-10-18" – nie Nutzereingabe. */
async function load(name: string, locale: string): Promise<LegalDocument | null> {
  for (const candidate of locale === FALLBACK_LOCALE ? [locale] : [locale, FALLBACK_LOCALE]) {
    const source = await read(`${name}.${candidate}.md`);
    if (source) return { locale: candidate, blocks: parseLegalMarkdown(source) };
  }
  return null;
}

/** Rechtsseite mit fester Datei (Datenschutz): content/legal/<seite>.<sprache>.md */
export function getLegalDocument(page: string, locale: string): Promise<LegalDocument | null> {
  return load(page, locale);
}

/** Eine Fassung der Nutzungsbedingungen; `version` stammt aus TERMS_VERSIONS (src/lib/legal.ts). */
export function getTermsDocument(version: string, locale: string): Promise<LegalDocument | null> {
  return load(`terms/${version}`, locale);
}
