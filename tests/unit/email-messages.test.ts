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

  it("Ergebnis eines Widerspruchs", () => {
    const values = { name: "Anna", title: "Bus X", note: "Passt.", url: "https://example.com" };
    const restored = t("appealResult.granted.body", { ...values, restored: "yes" });
    const notRestored = t("appealResult.granted.body", { ...values, restored: "no" });
    expect(restored.length).toBeGreaterThan(notRestored.length);
    expect(t("appealResult.denied.body", { ...values, restored: "no" })).toContain("Passt.");
  });
});
