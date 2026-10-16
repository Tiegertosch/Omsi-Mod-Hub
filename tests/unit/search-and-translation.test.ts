import { describe, expect, it } from "vitest";

import { truncateDescription } from "@/lib/metadata";
import { pageWindow } from "@/lib/pagination";
import { buildSearchText, normalizeSearchText, tokenizeQuery } from "@/lib/search-text";
import { pickTranslation } from "@/lib/translation";

describe("Suchnormalisierung", () => {
  it("normalisiert Groß-/Kleinschreibung inklusive Umlauten", () => {
    expect(normalizeSearchText("  ÜBERLAND   Gelenkbus ")).toBe("überland gelenkbus");
  });

  it("baut den Suchtext aus Texten und Tags", () => {
    expect(buildSearchText({ title: "Neustadt", summary: "Karte", description: "Stadt am Kanal", tags: ["Nachtverkehr"] })).toBe(
      "neustadt karte stadt am kanal nachtverkehr",
    );
  });

  it("zerlegt Anfragen, entfernt SQL-Wildcards und Duplikate", () => {
    expect(tokenizeQuery("Bus%  _bus  KARTE\\")).toEqual(["bus", "karte"]);
    expect(tokenizeQuery("   ")).toEqual([]);
    expect(tokenizeQuery("a b c d e f g h")).toHaveLength(6);
  });
});

describe("pickTranslation", () => {
  const translations = [
    { locale: "de", title: "Deutsch" },
    { locale: "en", title: "English" },
  ];

  it("liefert die gewünschte Sprache", () => {
    expect(pickTranslation(translations, "en", "de")).toEqual({ translation: translations[1], isFallback: false });
  });

  it("fällt auf die Originalsprache zurück", () => {
    expect(pickTranslation([translations[0]], "en", "de")).toEqual({ translation: translations[0], isFallback: true });
  });

  it("fällt auf die erste Übersetzung zurück und behandelt leere Listen", () => {
    expect(pickTranslation([translations[1]], "fr", "de")?.translation.locale).toBe("en");
    expect(pickTranslation([], "de")).toBeNull();
  });
});

describe("pageWindow", () => {
  it("zeigt Lücken zwischen entfernten Seiten", () => {
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});

describe("truncateDescription", () => {
  it("kürzt lange Texte an einer Wortgrenze", () => {
    const text = "Wort ".repeat(60);
    const result = truncateDescription(text, 50);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result.endsWith("…")).toBe(true);
    expect(truncateDescription("Kurz")).toBe("Kurz");
  });
});
