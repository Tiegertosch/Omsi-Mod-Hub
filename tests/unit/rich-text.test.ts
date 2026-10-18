import { describe, expect, it } from "vitest";

import { parseRichText, richTextToPlain, type RichInline } from "@/lib/rich-text";
import { buildSearchText } from "@/lib/search-text";

const text = (value: string): RichInline => ({ type: "text", text: value });
const inline = (source: string) => {
  const [block] = parseRichText(source);
  if (block?.type !== "paragraph") throw new Error(`kein Absatz: ${source}`);
  return block.content;
};

describe("Textformatierung", () => {
  it("erkennt fett, kursiv und unterstrichen", () => {
    expect(inline("Ein **neuer** Bus mit *Sound* und ++Licht++.")).toEqual([
      text("Ein "),
      { type: "strong", children: [text("neuer")] },
      text(" Bus mit "),
      { type: "em", children: [text("Sound")] },
      text(" und "),
      { type: "underline", children: [text("Licht")] },
      text("."),
    ]);
  });

  it("verschachtelt fett und kursiv", () => {
    expect(inline("***beides***")).toEqual([
      { type: "strong", children: [{ type: "em", children: [text("beides")] }] },
    ]);
    expect(inline("*kursiv mit **fett***")).toEqual([
      { type: "em", children: [text("kursiv mit "), { type: "strong", children: [text("fett")] }] },
    ]);
  });

  it("lässt alltägliche Zeichen als Text stehen", () => {
    expect(inline("C++ und C++-Plugins")).toEqual([text("C++ und C++-Plugins")]);
    expect(inline("5 * 3 = 15")).toEqual([text("5 * 3 = 15")]);
    expect(inline("**offen")).toEqual([text("**offen")]);
    expect(inline("** leer **")).toEqual([text("** leer **")]);
    expect(inline("\\*kein kursiv\\*")).toEqual([text("*kein kursiv*")]);
  });

  it("gibt Markup als Text aus, nie als HTML", () => {
    expect(inline("<script>alert(1)</script> **<b>x</b>**")).toEqual([
      text("<script>alert(1)</script> "),
      { type: "strong", children: [text("<b>x</b>")] },
    ]);
  });

  it("erkennt Überschriften, Listen und Absätze", () => {
    const blocks = parseRichText(
      "## Features\nErste Zeile\nzweite Zeile\n\n- Punkt A\n* Punkt **B**\n\n3. drei\n4. vier\n### Hinweis",
    );
    expect(blocks).toEqual([
      { type: "heading", level: 2, content: [text("Features")] },
      { type: "paragraph", content: [text("Erste Zeile"), { type: "break" }, text("zweite Zeile")] },
      { type: "list", ordered: false, start: 1, items: [[text("Punkt A")], [text("Punkt "), { type: "strong", children: [text("B")] }]] },
      { type: "list", ordered: true, start: 3, items: [[text("drei")], [text("vier")]] },
      { type: "heading", level: 3, content: [text("Hinweis")] },
    ]);
  });

  it("bleibt mit bisherigen Beschreibungen (reiner Text) gleich", () => {
    expect(parseRichText("Absatz eins.\n\nAbsatz zwei\nmit Umbruch.")).toEqual([
      { type: "paragraph", content: [text("Absatz eins.")] },
      { type: "paragraph", content: [text("Absatz zwei"), { type: "break" }, text("mit Umbruch.")] },
    ]);
    expect(parseRichText("#Hashtag")).toEqual([{ type: "paragraph", content: [text("#Hashtag")] }]);
  });

  it("ist auch bei präparierten Eingaben schnell", () => {
    const started = performance.now();
    parseRichText("*a ".repeat(7000));
    parseRichText("**".repeat(10000));
    parseRichText("*".repeat(20000));
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("entfernt Formatierung für Suche und Meta-Beschreibung", () => {
    expect(richTextToPlain("## Titel\n\n**Fett** und *kursiv*\n\n- A\n- B")).toBe("Titel Fett und kursiv A B");
    expect(buildSearchText({ title: "Bus", summary: "", description: "**Gelenkbus** mit ++Sound++" })).toBe(
      "bus gelenkbus mit sound",
    );
  });
});
