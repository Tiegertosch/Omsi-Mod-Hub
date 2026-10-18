/**
 * Einfache Textformatierung für Projektbeschreibung und Installationsanleitung.
 * Gespeichert wird reiner Text mit wenigen Zeichen, angelehnt an Markdown:
 *
 *   **fett**   *kursiv*   ++unterstrichen++
 *   ## Überschrift      ### kleinere Überschrift
 *   - Punkt (auch * oder •)      1. nummerierter Punkt
 *
 * Leerzeilen trennen Absätze, einfache Zeilenumbrüche bleiben erhalten. Ein
 * Backslash hebt ein Zeichen auf (\*). Es entsteht kein HTML: Die Ausgabe sind
 * Datenstrukturen, die React als Text rendert – Nutzereingaben können so kein
 * Markup oder Skript einschleusen. Links gibt es bewusst nicht.
 */
export type RichInline =
  | { type: "text"; text: string }
  | { type: "break" }
  | { type: "strong" | "em" | "underline"; children: RichInline[] };

export type RichBlock =
  | { type: "heading"; level: 2 | 3; content: RichInline[] }
  | { type: "paragraph"; content: RichInline[] }
  | { type: "list"; ordered: boolean; start: number; items: RichInline[][] };

type Marker = { token: string; type: "strong" | "em" | "underline" };

// Längere Zeichen zuerst, damit „**“ nicht als zweimal „*“ gelesen wird.
const MARKERS: readonly Marker[] = [
  { token: "**", type: "strong" },
  { token: "++", type: "underline" },
  { token: "*", type: "em" },
];

const ESCAPABLE = new Set(["\\", "*", "+", "#", "-", "•"]);
/** Verschachtelung begrenzen (z. B. fett in kursiv), damit präparierte Texte nicht teuer werden. */
const MAX_DEPTH = 4;

const isSpace = (char: string | undefined) => char === undefined || /\s/.test(char);
const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);

/**
 * Öffnendes Zeichen: danach kein Leerraum. Unterstreichen zusätzlich nicht
 * direkt nach Buchstaben oder Ziffern, damit „C++“ Text bleibt.
 */
function canOpen(text: string, index: number, marker: Marker) {
  if (isSpace(text[index + marker.token.length])) return false;
  return marker.type !== "underline" || !isWordChar(text[index - 1]);
}

/**
 * Schließendes Zeichen: davor kein Leerraum. Sternchen werden als Folge
 * betrachtet, damit Kombinationen aufgehen: In „*a **b***“ schließt „***“
 * erst fett, dann kursiv; eine Zweierfolge innerhalb von Kursivtext ist fett.
 */
function closingIndex(text: string, from: number, marker: Marker): number {
  for (let index = from; index < text.length; index++) {
    if (text[index] === "\\") {
      index++;
      continue;
    }
    if (marker.token === "++") {
      if (text.startsWith("++", index) && !isSpace(text[index - 1])) return index;
      continue;
    }
    if (text[index] !== "*") continue;
    let run = 1;
    while (text[index + run] === "*") run++;
    if (!isSpace(text[index - 1])) {
      if (marker.token === "**" && run >= 2) return index + run - 2;
      if (marker.token === "*" && run !== 2) return index + run - 1;
    }
    index += run - 1;
  }
  return -1;
}

function parseInline(text: string, depth: number): RichInline[] {
  const result: RichInline[] = [];
  let buffer = "";
  // Ab dieser Position gibt es für das Zeichen kein schließendes Gegenstück mehr – spart wiederholtes Suchen.
  const exhausted = new Map<string, number>();
  const flush = () => {
    if (buffer) result.push({ type: "text", text: buffer });
    buffer = "";
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "\\" && ESCAPABLE.has(text[index + 1] ?? "")) {
      buffer += text[index + 1];
      index++;
      continue;
    }
    if (char === "\n") {
      flush();
      result.push({ type: "break" });
      continue;
    }
    const marker = depth < MAX_DEPTH ? MARKERS.find((m) => text.startsWith(m.token, index)) : undefined;
    if (marker && canOpen(text, index, marker) && index < (exhausted.get(marker.token) ?? Infinity)) {
      const start = index + marker.token.length;
      const end = closingIndex(text, start + 1, marker);
      if (end === -1) {
        exhausted.set(marker.token, index);
      } else {
        flush();
        result.push({ type: marker.type, children: parseInline(text.slice(start, end), depth + 1) });
        index = end + marker.token.length - 1;
        continue;
      }
    }
    buffer += char;
  }
  flush();
  return result;
}

const HEADING = /^(#{1,3})\s+(.+)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,4})[.)]\s+(.*)$/;

export function parseRichText(source: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let paragraph: string[] = [];
  let list: Extract<RichBlock, { type: "list" }> | null = null;

  const endParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", content: parseInline(paragraph.join("\n"), 0) });
    paragraph = [];
  };
  const endBlock = () => {
    endParagraph();
    list = null;
  };
  const addItem = (ordered: boolean, start: number, text: string) => {
    endParagraph();
    if (!list || list.ordered !== ordered) {
      list = { type: "list", ordered, start, items: [] };
      blocks.push(list);
    }
    list.items.push(parseInline(text.trim(), 0));
  };

  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) {
      endBlock();
      continue;
    }
    const heading = HEADING.exec(line.trim());
    if (heading) {
      endBlock();
      blocks.push({ type: "heading", level: heading[1].length === 3 ? 3 : 2, content: parseInline(heading[2].trim(), 0) });
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      addItem(false, 1, bullet[1]);
      continue;
    }
    const numbered = NUMBERED.exec(line);
    if (numbered) {
      addItem(true, Number(numbered[1]), numbered[2]);
      continue;
    }
    list = null;
    paragraph.push(line.trim());
  }
  endBlock();
  // Leere Listenpunkte („- “) ergeben keinen sichtbaren Inhalt.
  return blocks.filter((block) => block.type !== "list" || block.items.some((item) => item.length > 0));
}

function inlineText(content: RichInline[]): string {
  return content.map((node) => (node.type === "text" ? node.text : node.type === "break" ? " " : inlineText(node.children))).join("");
}

/** Text ohne Formatierungszeichen, z. B. für die Suche oder Meta-Beschreibungen. */
export function richTextToPlain(source: string): string {
  return parseRichText(source)
    .map((block) => (block.type === "list" ? block.items.map(inlineText).join(" ") : inlineText(block.content)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
