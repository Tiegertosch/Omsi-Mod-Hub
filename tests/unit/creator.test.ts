import { describe, expect, it } from "vitest";

import { detectImageKind, mediaKeyFromUrl } from "@/lib/image-signature";
import { projectFormSchema, readProjectForm, readVersionForm, versionFormSchema } from "@/lib/project-form";
import { availableCreatorActions, isEditableByCreator, nextStatusForCreator, publishChecklist } from "@/lib/project-status";
import { isValidSlug, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("transliteriert Umlaute und entfernt Sonderzeichen", () => {
    expect(slugify("Überland Straße – Version 2!")).toBe("ueberland-strasse-version-2");
    expect(slugify("  Café   Crème  ")).toBe("cafe-creme");
    expect(slugify("---")).toBe("");
  });

  it("begrenzt die Länge ohne Bindestrich am Ende", () => {
    const slug = slugify("a".repeat(79) + " bbbb");
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("prüft gültige Slugs", () => {
    expect(isValidSlug("neustadt-am-kanal")).toBe(true);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("mit--doppelt")).toBe(false);
    expect(isValidSlug("Gross")).toBe(false);
    expect(isValidSlug("../etc")).toBe(false);
  });
});

describe("Statusübergänge", () => {
  const withReview = { reviewRequired: true };
  const direct = { reviewRequired: false };

  it("Einreichen führt je nach Konfiguration zur Prüfung oder direkt zur Veröffentlichung", () => {
    expect(nextStatusForCreator("DRAFT", "submit", withReview)).toBe("PENDING_REVIEW");
    expect(nextStatusForCreator("REJECTED", "submit", withReview)).toBe("PENDING_REVIEW");
    expect(nextStatusForCreator("DRAFT", "submit", direct)).toBe("PUBLISHED");
  });

  it("verhindert unzulässige Übergänge", () => {
    expect(nextStatusForCreator("PUBLISHED", "submit", withReview)).toBeNull();
    expect(nextStatusForCreator("HIDDEN", "restore", withReview)).toBeNull();
    expect(nextStatusForCreator("HIDDEN", "archive", withReview)).toBeNull();
    expect(nextStatusForCreator("DRAFT", "withdraw", withReview)).toBeNull();
  });

  it("listet verfügbare Aktionen", () => {
    expect(availableCreatorActions("DRAFT", withReview)).toEqual(["submit", "archive"]);
    expect(availableCreatorActions("PENDING_REVIEW", withReview)).toEqual(["withdraw"]);
    expect(availableCreatorActions("ARCHIVED", withReview)).toEqual(["restore"]);
    expect(availableCreatorActions("HIDDEN", withReview)).toEqual([]);
  });

  it("sperrt die Bearbeitung in Prüfung und bei Moderation", () => {
    expect(isEditableByCreator("PENDING_REVIEW")).toBe(false);
    expect(isEditableByCreator("HIDDEN")).toBe(false);
    expect(isEditableByCreator("PUBLISHED")).toBe(true);
  });
});

describe("publishChecklist", () => {
  const complete = {
    defaultLocale: "de",
    license: "Private Nutzung",
    categoryId: "c1",
    coverImageUrl: null,
    translations: [{ locale: "de", title: "T", summary: "S", description: "D" }],
    versions: [{ links: [{}] }],
  };

  it("ist bereit, wenn alle Pflichtpunkte erfüllt sind (Titelbild optional)", () => {
    expect(publishChecklist(complete).ready).toBe(true);
  });

  it("verlangt Übersetzung in der Originalsprache und mindestens einen Link", () => {
    expect(publishChecklist({ ...complete, defaultLocale: "en" }).ready).toBe(false);
    expect(publishChecklist({ ...complete, versions: [{ links: [] }] }).ready).toBe(false);
    expect(publishChecklist({ ...complete, versions: [] }).ready).toBe(false);
  });
});

describe("Bild-Signaturen und Medien-Schlüssel", () => {
  it("erkennt JPEG, PNG und WebP an den Magic Bytes", () => {
    expect(detectImageKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(detectImageKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    const webp = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");
    expect(detectImageKind(webp)).toBe("webp");
  });

  it("lehnt andere Inhalte ab, auch mit Bild-Endung", () => {
    expect(detectImageKind(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(detectImageKind(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(detectImageKind(new Uint8Array([]))).toBeNull();
  });

  it("akzeptiert nur gültige Medien-Schlüssel", () => {
    expect(mediaKeyFromUrl(`/media/${"a".repeat(32)}.webp`)).toBe(`${"a".repeat(32)}.webp`);
    expect(mediaKeyFromUrl("/media/../../.env")).toBeNull();
    expect(mediaKeyFromUrl("/samples/bus-city.svg")).toBeNull();
    expect(mediaKeyFromUrl(null)).toBeNull();
  });
});

function formData(entries: [string, string][]) {
  const fd = new FormData();
  for (const [key, value] of entries) fd.append(key, value);
  return fd;
}

describe("Projektformular", () => {
  const base: [string, string][] = [
    ["categoryId", "cat1"],
    ["defaultLocale", "de"],
    ["slug", ""],
    ["license", "Private Nutzung"],
    ["translations.de.title", "Neustadt"],
    ["translations.de.summary", "Kurz"],
    ["translations.de.description", "Lang"],
  ];

  it("akzeptiert ein vollständiges Projekt und liest Zeilen in Index-Reihenfolge", () => {
    const parsed = projectFormSchema.safeParse(
      readProjectForm(
        formData([
          ...base,
          ["tags", "diesel"],
          ["tags", "diesel"],
          ["contributors.2.name", "B"],
          ["contributors.0.name", "A"],
          ["contributors.0.role", "Karten"],
        ]),
      ),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.tags).toEqual(["diesel"]);
    expect(parsed.data.contributors.map((c) => c.name)).toEqual(["A", "B"]);
    expect(parsed.data.translations.en.title).toBe("");
  });

  it("verlangt die Originalsprache vollständig und eine begonnene Zweitsprache ebenfalls", () => {
    const parsed = projectFormSchema.safeParse(
      readProjectForm(formData([...base.filter(([k]) => k !== "translations.de.summary"), ["translations.en.title", "Only title"]])),
    );
    expect(parsed.success).toBe(false);
    const paths = parsed.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths).toContain("translations.de.summary");
    expect(paths).toContain("translations.en.summary");
    expect(paths).toContain("translations.en.description");
  });

  it("lehnt unsichere Quell-URLs ab", () => {
    const parsed = projectFormSchema.safeParse(readProjectForm(formData([...base, ["sourceUrl", "javascript:alert(1)"]])));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path.join(".")).toBe("sourceUrl");
  });
});

describe("Versionsformular", () => {
  it("verlangt mindestens einen gültigen Link", () => {
    const empty = versionFormSchema.safeParse(readVersionForm(formData([["version", "1.0"], ["links.0.url", ""]])));
    expect(empty.success).toBe(false);
    expect(empty.error?.issues.map((i) => i.message)).toContain("linksRequired");

    const local = versionFormSchema.safeParse(
      readVersionForm(formData([["version", "1.0"], ["links.0.url", "http://192.168.0.1/mod.zip"]])),
    );
    expect(local.success).toBe(false);
    expect(local.error?.issues[0]?.path.join(".")).toBe("links.0.url");
  });

  it("prüft das Versionsformat und ersetzt unbekannte Linktypen", () => {
    expect(versionFormSchema.safeParse(readVersionForm(formData([["version", "<script>"], ["links.0.url", "https://example.com/a"]]))).success).toBe(false);
    const ok = versionFormSchema.safeParse(
      readVersionForm(formData([["version", "2.1-beta"], ["links.0.url", "https://example.com/a"], ["links.0.sourceType", "EVIL"]])),
    );
    expect(ok.success).toBe(true);
    expect(ok.data?.links[0]?.sourceType).toBe("FILE_HOSTER");
  });
});
