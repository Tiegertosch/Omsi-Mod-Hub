import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import de from "../../messages/de.json";
import en from "../../messages/en.json";

// Die neuen Mail-Texte nutzen Plural, Select und Datumsformat; Syntaxfehler
// fielen sonst erst beim Versand auf.
describe.each([
  ["de", de],
  ["en", en],
] as const)("E-Mail-Texte (%s)", (locale, messages) => {
  const t = createTranslator({ locale, messages, namespace: "Email", timeZone: "Europe/Berlin" });
  const until = new Date("2027-05-01T10:00:00.000Z");

  it("Sperre: Dauer und Zahl der ausgeblendeten Projekte", () => {
    const base = { name: "Anna", reason: "Spam-Links", contactUrl: "https://example.com/de/legal/imprint" };
    const none = t("ban.body", { ...base, duration: t("ban.permanent"), hidden: 0 });
    const two = t("ban.body", { ...base, duration: t("ban.until", { until }), hidden: 2 });
    expect(none).toContain("Spam-Links");
    expect(none).toContain(t("ban.permanent"));
    expect(two).toContain("2");
    expect(two).toContain("2027");
    expect(none.length).toBeLessThan(two.length);
  });

  it("Widerspruchshinweis mit Frist und Link", () => {
    const text = t("appealHint", { appealUntil: until, appealUrl: "https://example.com/de/appeal?token=x" });
    expect(text).toContain("2027");
    expect(text).toContain("https://example.com/de/appeal?token=x");
  });

  it("Zwei-Faktor-Hinweise und Löschcode", () => {
    for (const change of ["enabled", "disabled"] as const) {
      expect(t(`twoFactor.${change}.body`, { name: "Anna", url: "https://example.com/s" })).toContain("https://example.com/s");
    }
    const deletion = t("projectDeleteBody", { name: "Anna", title: "Bus X", code: "012345", minutes: 15, url: "https://e/x" });
    expect(deletion).toContain("012345");
    expect(deletion).toContain("15");
  });

  it("Linkstatus mit und ohne Begründung", () => {
    const values = { name: "Anna", title: "Bus X", version: "1.0", url: "https://example.com/x", editUrl: "https://e/x" };
    expect(t("link.blocked.body", { ...values, note: "Schadsoftware", hasNote: "yes" })).toContain("Schadsoftware");
    const withNote = t("link.broken.body", { ...values, note: "404", hasNote: "yes" });
    const withoutNote = t("link.broken.body", { ...values, note: "", hasNote: "no" });
    expect(withNote).toContain("404");
    expect(withoutNote.length).toBeLessThan(withNote.length);
  });

  it("Ergebnis eines Widerspruchs", () => {
    const values = { name: "Anna", title: "Bus X", note: "Passt.", url: "https://example.com" };
    const restored = t("appealResult.granted.body", { ...values, restored: "yes" });
    const notRestored = t("appealResult.granted.body", { ...values, restored: "no" });
    expect(restored.length).toBeGreaterThan(notRestored.length);
    expect(t("appealResult.denied.body", { ...values, restored: "no" })).toContain("Passt.");
  });

  it("Neue Version eines gemerkten Projekts: Changelog nur, wenn vorhanden; Abmeldelink als eigener Absatz", () => {
    const values = {
      name: "Anna",
      title: "Bus X",
      version: "2.0",
      url: "https://example.com/de/mods/bus-x",
      unsubscribeUrl: "https://example.com/de/unsubscribe?u=1&s=x",
      favoritesUrl: "https://example.com/de/dashboard/favorites",
    };
    const withLog = t("projectUpdate.body", { ...values, changelog: "Neue Haltestellen", hasChangelog: "yes" });
    const without = t("projectUpdate.body", { ...values, changelog: "", hasChangelog: "no" });
    expect(withLog).toContain("Neue Haltestellen");
    expect(without.length).toBeLessThan(withLog.length);
    // Der Abmeldelink steht allein in einem Absatz und wird so im HTML zum Button.
    const paragraphs = withLog.split(/\n{2,}/);
    expect(paragraphs).toContain(values.unsubscribeUrl);
    expect(paragraphs).toContain(values.url);
    expect(t("projectUpdate.subject", { title: "Bus X", version: "2.0" })).toContain("2.0");
  });
});
