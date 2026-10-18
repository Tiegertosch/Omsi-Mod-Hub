import { describe, expect, it } from "vitest";

import { catalogQuery, MAX_TAG_FILTERS, parseCatalogParams, toggleTag } from "@/lib/catalog-params";

describe("parseCatalogParams", () => {
  it("liefert Standardwerte bei leeren Parametern", () => {
    expect(parseCatalogParams({})).toEqual({ q: "", tags: [], sort: "newest", price: "all", page: 1 });
  });

  it("liest gültige Werte", () => {
    expect(
      parseCatalogParams({ q: "  Gelenkbus ", tag: ["diesel", "solobus"], sort: "popular", price: "paid", page: "3" }),
    ).toEqual({
      q: "Gelenkbus",
      tags: ["diesel", "solobus"],
      sort: "popular",
      price: "paid",
      page: 3,
    });
  });

  it("fällt bei ungültigen Werten auf sichere Standards zurück", () => {
    const params = parseCatalogParams({ sort: "DROP TABLE", price: "gratis", page: "-4", tag: ["../etc", "ok-tag", "Ok-Tag"] });
    expect(params.sort).toBe("newest");
    expect(params.price).toBe("all");
    expect(params.page).toBe(1);
    expect(params.tags).toEqual(["ok-tag"]);
  });

  it("begrenzt Suchlänge, Seitenzahl und Anzahl der Tags", () => {
    const params = parseCatalogParams({
      q: "x".repeat(500),
      page: "999999",
      tag: Array.from({ length: 20 }, (_, i) => `tag-${i}`),
    });
    expect(params.q).toHaveLength(100);
    expect(params.page).toBe(1);
    expect(params.tags).toHaveLength(MAX_TAG_FILTERS);
  });

  it("akzeptiert kommagetrennte Tags und entfernt Duplikate", () => {
    expect(parseCatalogParams({ tag: "diesel,solobus,diesel" }).tags).toEqual(["diesel", "solobus"]);
  });

  it("nimmt bei mehrfachen Einzelwerten den ersten", () => {
    expect(parseCatalogParams({ q: ["eins", "zwei"], sort: ["updated", "popular"] })).toMatchObject({
      q: "eins",
      sort: "updated",
    });
  });
});

describe("catalogQuery", () => {
  it("lässt Standardwerte weg", () => {
    expect(catalogQuery({ q: "", tags: [], sort: "newest", price: "all", page: 1 })).toEqual({});
  });

  it("serialisiert gesetzte Werte", () => {
    expect(catalogQuery({ q: "bus", tags: ["diesel"], sort: "updated", price: "free", page: 2 })).toEqual({
      q: "bus",
      tag: ["diesel"],
      sort: "updated",
      price: "free",
      page: "2",
    });
  });
});

describe("toggleTag", () => {
  it("fügt Tags hinzu und entfernt sie", () => {
    expect(toggleTag(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleTag(["a", "b"], "a")).toEqual(["b"]);
  });
});
