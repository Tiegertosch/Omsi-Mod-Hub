import { describe, expect, it } from "vitest";

import {
  deletionCodeMatches,
  generateDeletionCode,
  hashDeletionCode,
  normalizeDeletionCode,
  projectDeletionIdentifier,
} from "@/lib/project-deletion";

describe("Löschcode für Projekte", () => {
  it("erzeugt immer genau sechs Ziffern", () => {
    for (let i = 0; i < 200; i++) expect(generateDeletionCode()).toMatch(/^\d{6}$/);
  });

  it("normalisiert Eingaben und weist alles andere ab", () => {
    expect(normalizeDeletionCode(" 012 345 ")).toBe("012345");
    expect(normalizeDeletionCode("012-345")).toBe("012345");
    expect(normalizeDeletionCode("12345")).toBeNull();
    expect(normalizeDeletionCode("1234567")).toBeNull();
    expect(normalizeDeletionCode("12a456")).toBeNull();
    expect(normalizeDeletionCode("")).toBeNull();
  });

  it("speichert nur den Hash und prüft ihn je Projekt", () => {
    const hash = hashDeletionCode("projekt-a", "482913");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("482913");
    expect(deletionCodeMatches(hash, "projekt-a", "482913")).toBe(true);
    expect(deletionCodeMatches(hash, "projekt-a", "482914")).toBe(false);
    // Derselbe Code gilt nicht für ein anderes Projekt.
    expect(deletionCodeMatches(hash, "projekt-b", "482913")).toBe(false);
    // Beschädigter Eintrag führt zu „falsch“, nicht zu einem Fehler.
    expect(deletionCodeMatches("kein-hash", "projekt-a", "482913")).toBe(false);
  });

  it("verwendet einen eigenen Bezeichner pro Projekt", () => {
    expect(projectDeletionIdentifier("abc")).toBe("project-delete:abc");
  });
});
