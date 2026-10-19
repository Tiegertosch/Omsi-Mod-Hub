import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { TERMS_VERSION } from "@/lib/legal";
import { parseInline, parseLegalMarkdown } from "@/lib/legal-markdown";

describe("parseLegalMarkdown", () => {
  it("erkennt Überschriften, Unterpunkte, Aufzählungen und Absätze", () => {
    const blocks = parseLegalMarkdown(
      [
        "# **Titel**",
        "Einleitung mit [Link](https://example.com/a).",
        "## **1. Abschnitt**",
        "a) Recht auf Auskunft",
        "• erster Punkt,",
        "• zweiter Punkt",
        "**Ganz fett.**",
      ].join("\r\n\r\n"),
    );
    expect(blocks).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Einleitung mit " },
          { type: "link", text: "Link", href: "https://example.com/a" },
          { type: "text", text: "." },
        ],
      },
      { type: "heading", level: 2, text: "1. Abschnitt" },
      { type: "heading", level: 3, text: "a) Recht auf Auskunft" },
      {
        type: "list",
        items: [[{ type: "text", text: "erster Punkt," }], [{ type: "text", text: "zweiter Punkt" }]],
      },
      { type: "paragraph", content: [{ type: "strong", text: "Ganz fett." }] },
    ]);
  });

  it("lässt nur https-Links zu und setzt Gedankenstriche", () => {
    expect(parseInline("[x](javascript:alert(1)) und --- y")).toEqual([
      { type: "text", text: "[x](javascript:alert(1)) und – y" },
    ]);
    expect(parseInline("omsi-modhub -- Tobias")).toEqual([{ type: "text", text: "omsi-modhub – Tobias" }]);
  });

  it("verarbeitet die abgelegte Datenschutzerklärung vollständig", () => {
    const source = readFileSync(path.join(process.cwd(), "content", "legal", "privacy.de.md"), "utf8");
    const blocks = parseLegalMarkdown(source);
    const sections = blocks.filter((b) => b.type === "heading" && b.level === 2).map((b) => b.type === "heading" && b.text);
    expect(sections).toHaveLength(25);
    expect(sections[0]).toBe("1. Definitionen");
    expect(sections[15]).toBe("16. Datenschutzbestimmungen zu Einsatz und Verwendung von Hetzner");
    expect(sections[24]).toBe("25. Keine Drittanbieter-Inhalte im Browser");
    // Kein Markdown bleibt als Text stehen.
    const text = JSON.stringify(blocks);
    expect(text).not.toContain("**");
    expect(text).not.toContain("](");
    expect(text).not.toContain(" -- ");
    expect(text).not.toContain("`");
    expect(text).not.toContain("| ---");

    // Cookie-Tabelle in Abschnitt 20: drei Cookies, Namen als Code
    const table = blocks.find((b) => b.type === "table");
    expect(table?.type === "table" && table.header.map((cell) => cell[0]?.text)).toEqual(["Cookie", "Zweck", "Dauer"]);
    expect(table?.type === "table" && table.rows.map((row) => row[0]?.[0])).toEqual([
      { type: "code", text: "better-auth.session_token" },
      { type: "code", text: "omh-pending-registration" },
      { type: "code", text: "NEXT_LOCALE" },
    ]);

    // Die konkreten Löschfristen in Abschnitt 10 sind eine Liste mit neun Punkten.
    const retention = blocks.find(
      (b) => b.type === "list" && b.items.some((item) => item.some((part) => part.text === "Zugriffslogs:")),
    );
    expect(retention?.type === "list" && retention.items).toHaveLength(9);
  });

  it("erkennt Markdown-Listen mit „- “ in aufeinanderfolgenden Zeilen", () => {
    expect(parseLegalMarkdown("Einleitung:\n\n- **A:** eins\n- zwei\n\nSchluss.")).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Einleitung:" }] },
      {
        type: "list",
        items: [
          [
            { type: "strong", text: "A:" },
            { type: "text", text: " eins" },
          ],
          [{ type: "text", text: "zwei" }],
        ],
      },
      { type: "paragraph", content: [{ type: "text", text: "Schluss." }] },
    ]);
    expect(parseLegalMarkdown("| A | B |\n| --- | --- |\n| `x` | **y** |")).toEqual([
      {
        type: "table",
        header: [[{ type: "text", text: "A" }], [{ type: "text", text: "B" }]],
        rows: [[[{ type: "code", text: "x" }], [{ type: "strong", text: "y" }]]],
      },
    ]);
    // Ein Gedankenstrich mitten im Absatz bleibt Text.
    expect(parseLegalMarkdown("Text\n- kein Punkt")[0]?.type).toBe("paragraph");
  });

  it("hat in beiden Fassungen der Nutzungsbedingungen dieselben Abschnitte", () => {
    const headings = (locale: string) =>
      parseLegalMarkdown(readFileSync(path.join(process.cwd(), "content", "legal", "terms", `${TERMS_VERSION}.${locale}.md`), "utf8"))
        .filter((b) => b.type === "heading")
        .map((b) => (b.type === "heading" ? b.text.split(".")[0] : ""));
    const de = headings("de");
    expect(de).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(headings("en")).toEqual(de);
  });

  it("nennt in beiden Fassungen den Stand, der zu TERMS_VERSION passt", () => {
    const [year, month, day] = TERMS_VERSION.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const format = (locale: string) =>
      new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
    const read = (locale: string) =>
      readFileSync(path.join(process.cwd(), "content", "legal", "terms", `${TERMS_VERSION}.${locale}.md`), "utf8");
    expect(read("de")).toContain(`Stand: ${format("de-DE")}`);
    expect(read("en")).toContain(`Last updated: ${format("en-GB")}`);
  });
});
