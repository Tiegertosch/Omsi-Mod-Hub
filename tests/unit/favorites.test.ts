import { describe, expect, it } from "vitest";

import { changelogExcerpt } from "@/lib/favorites";

describe("Changelog-Auszug für Update-Mails", () => {
  it("lässt kurze Texte unverändert, fasst Leerzeilen zusammen", () => {
    expect(changelogExcerpt("Neu:\r\n\r\n\r\n- Haltestellen")).toBe("Neu:\n\n- Haltestellen");
    expect(changelogExcerpt(null)).toBe("");
  });

  it("kürzt lange Texte an einer Wortgrenze mit Auslassungszeichen", () => {
    const text = "Wort ".repeat(40);
    const excerpt = changelogExcerpt(text, 52);
    expect(excerpt).toBe(`${"Wort ".repeat(10).trimEnd()} …`);
    expect(excerpt.length).toBeLessThanOrEqual(54);
  });

  it("kürzt hart, wenn keine passende Wortgrenze existiert", () => {
    expect(changelogExcerpt("x".repeat(20), 10)).toBe(`${"x".repeat(10)} …`);
  });
});
