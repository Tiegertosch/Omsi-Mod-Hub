/**
 * Minimaler Parser für Rechtstexte aus Generatoren (Markdown-Export), damit
 * sie unverändert als Datei abgelegt werden können. Unterstützt nur, was
 * diese Texte brauchen: Überschriften, Absätze, Aufzählungen mit „•“,
 * Fettdruck und Links (nur https). Es entsteht kein HTML – die Ausgabe sind
 * Datenstrukturen, die React als Text rendert.
 */
export type LegalInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "link"; text: string; href: string };

export type LegalBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; content: LegalInline[] }
  | { type: "list"; items: LegalInline[][] };

const INLINE = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)|\*\*(.+?)\*\*/g;
/** Unterpunkte wie „a) Recht auf Auskunft“ stehen als eigene, kurze Zeile ohne Satzende. */
const SUBHEADING = /^[a-z]\)\s+[^.:]{1,90}$/;

/** Gedankenstriche aus dem Export („---“, „--“) wieder als Halbgeviertstrich. */
const typography = (text: string) => text.replace(/\s---?\s/g, " – ");

const stripStrong = (text: string) => text.replace(/^\*\*(.*)\*\*$/, "$1").trim();

export function parseInline(text: string): LegalInline[] {
  const result: LegalInline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) result.push({ type: "text", text: typography(text.slice(last, index)) });
    if (match[1] !== undefined && match[2] !== undefined) {
      result.push({ type: "link", text: typography(match[1]), href: match[2] });
    } else {
      result.push({ type: "strong", text: typography(match[3] ?? "") });
    }
    last = index + match[0].length;
  }
  if (last < text.length) result.push({ type: "text", text: typography(text.slice(last)) });
  return result;
}

/** Zerlegt den Text in Blöcke; die Hauptüberschrift (`# …`) entfällt, die Seite setzt den Titel selbst. */
export function parseLegalMarkdown(source: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  const chunks = source
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const text = chunk.replace(/\s*\n\s*/g, " ");
    if (text.startsWith("# ")) continue;
    if (text.startsWith("### ")) {
      blocks.push({ type: "heading", level: 3, text: typography(stripStrong(text.slice(4))) });
    } else if (text.startsWith("## ")) {
      blocks.push({ type: "heading", level: 2, text: typography(stripStrong(text.slice(3))) });
    } else if (text.startsWith("• ")) {
      const item = parseInline(text.slice(2));
      const previous = blocks.at(-1);
      if (previous?.type === "list") previous.items.push(item);
      else blocks.push({ type: "list", items: [item] });
    } else if (SUBHEADING.test(text)) {
      blocks.push({ type: "heading", level: 3, text: typography(text) });
    } else {
      blocks.push({ type: "paragraph", content: parseInline(text) });
    }
  }
  return blocks;
}
