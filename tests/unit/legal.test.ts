import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  berlinDate,
  LATEST_TERMS,
  needsTermsConsent,
  TERMS_VERSION,
  TERMS_VERSIONS,
  termsInForce,
  upcomingTerms,
} from "@/lib/legal";

describe("Fassungen der Nutzungsbedingungen", () => {
  it("sind aufsteigend sortiert, eindeutig und haben Texte in beiden Sprachen", () => {
    const versions = TERMS_VERSIONS.map((entry) => entry.version);
    expect([...versions].sort()).toEqual(versions);
    expect(new Set(versions).size).toBe(versions.length);
    for (const entry of TERMS_VERSIONS) {
      expect(entry.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.changes.de.length).toBeGreaterThan(0);
      expect(entry.changes.en).toHaveLength(entry.changes.de.length);
      for (const locale of ["de", "en"]) {
        expect(existsSync(path.join(process.cwd(), "content", "legal", "terms", `${entry.version}.${locale}.md`))).toBe(true);
      }
    }
    expect(TERMS_VERSION).toBe(LATEST_TERMS.version);
  });

  it("verlangt eine Zustimmung, solange nicht der neuesten Fassung zugestimmt wurde", () => {
    expect(needsTermsConsent(null)).toBe(true);
    expect(needsTermsConsent(undefined)).toBe(true);
    expect(needsTermsConsent("2000-01-01")).toBe(true);
    expect(needsTermsConsent(TERMS_VERSION)).toBe(false);
  });

  it("rechnet den Stichtag in deutscher Zeit", () => {
    // 23:30 UTC am 17.10. ist in Berlin schon der 18.10.
    expect(berlinDate(new Date("2026-10-17T23:30:00Z"))).toBe("2026-10-18");
    expect(berlinDate(new Date("2026-10-17T21:00:00Z"))).toBe("2026-10-17");
  });

  it("zeigt die geltende Fassung und kündigt eine spätere an", () => {
    const dayBefore = new Date(`${LATEST_TERMS.effectiveFrom}T12:00:00Z`);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
    const onTheDay = new Date(`${LATEST_TERMS.effectiveFrom}T12:00:00Z`);

    expect(termsInForce(onTheDay).version).toBe(LATEST_TERMS.version);
    expect(upcomingTerms(onTheDay)).toBeNull();
    expect(upcomingTerms(dayBefore)?.version).toBe(LATEST_TERMS.version);
    // Vor der ersten Fassung gilt trotzdem die erste (es gibt keine ältere).
    if (TERMS_VERSIONS.length === 1) expect(termsInForce(dayBefore).version).toBe(LATEST_TERMS.version);
  });
});
