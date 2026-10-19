/**
 * Minimaler Parser für Rechtstexte aus Generatoren (Markdown-Export), damit
 * sie unverändert als Datei abgelegt werden können. Unterstützt nur, was
 * diese Texte brauchen: Überschriften, Absätze, Aufzählungen mit „•“ (je
 * Punkt ein Absatz) oder „- “ (Punkte in aufeinanderfolgenden Zeilen),
 * einfache Tabellen, `Code`, Fettdruck und Links (nur https). Es entsteht kein HTML – die Ausgabe sind
 * Datenstrukturen, die React als Text rendert.
 */
export type LegalInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "code"; text: string }
  | { type: "break"; text: "\n" }
  | { type: "link"; text: string; href: string };

export type LegalBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; content: LegalInline[] }
  | { type: "list"; items: LegalInline[][] }
  | { type: "table"; header: LegalInline[][]; rows: LegalInline[][][] };

const INLINE = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)|\*\*(.+?)\*\*|`([^`]+)`/g;
/** Trennzeile einer Markdown-Tabelle, z. B. „| --- | :---: |“. */
const TABLE_SEPARATOR = /^\|(\s*:?-{3,}:?\s*\|)+$/;

function tableCells(line: string): LegalInline[][] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => parseInline(cell.trim()));
}
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
    } else if (match[4] !== undefined) {
      result.push({ type: "code", text: match[4] });
    } else {
      result.push({ type: "strong", text: typography(match[3] ?? "") });
    }
    last = index + match[0].length;
  }
  if (last < text.length) result.push({ type: "text", text: typography(text.slice(last)) });
  return result;
}

/**
 * Zeilen eines Absatzes werden zu einem Fließtext verbunden. Endet eine Zeile
 * mit zwei Leerzeichen (Markdown-Zeilenumbruch, z. B. in Adressblöcken), bleibt
 * der Umbruch erhalten.
 */
function paragraphContent(chunk: string): LegalInline[] {
  const lines = chunk.split("\n");
  // Ohne Zeilenumbruch wie bisher als Ganzes, damit Fettdruck über Zeilen hinweg erhalten bleibt.
  if (!lines.slice(0, -1).some((line) => / {2,}$/.test(line))) return parseInline(chunk.replace(/\s*\n\s*/g, " "));
  const content: LegalInline[] = [];
  lines.forEach((line, index) => {
    content.push(...parseInline(line.trim()));
    if (index < lines.length - 1) content.push(/ {2,}$/.test(line) ? { type: "break", text: "\n" } : { type: "text", text: " " });
  });
  // Benachbarte Textteile zusammenfassen, damit das Ergebnis wie ein einzeiliger Absatz aussieht.
  return content.reduce<LegalInline[]>((merged, part) => {
    const previous = merged.at(-1);
    if (part.type === "text" && previous?.type === "text") previous.text += part.text;
    else merged.push({ ...part });
    return merged;
  }, []);
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
    const lines = chunk.split("\n").map((line) => line.trim());
    // Markdown-Tabelle: Kopfzeile, Trennzeile, Datenzeilen – alle mit „|“.
    if (lines.length >= 2 && lines.every((line) => line.startsWith("|")) && TABLE_SEPARATOR.test(lines[1])) {
      blocks.push({ type: "table", header: tableCells(lines[0]), rows: lines.slice(2).map(tableCells) });
      continue;
    }
    // Markdown-Liste: jede Zeile des Absatzes beginnt mit „- “ oder „• “.
    if (lines.every((line) => /^[-•] /.test(line))) {
      const items = lines.map((line) => parseInline(line.slice(2)));
      const previous = blocks.at(-1);
      if (previous?.type === "list") previous.items.push(...items);
      else blocks.push({ type: "list", items });
      continue;
    }
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
    } else if (SUBHEADING.test(stripStrong(text))) {
      // Unterpunkte auch fett gesetzt („**a) Personal data**“, englische Fassung).
      blocks.push({ type: "heading", level: 3, text: typography(stripStrong(text)) });
    } else {
      blocks.push({ type: "paragraph", content: paragraphContent(chunk) });
    }
  }
  return blocks;
}
