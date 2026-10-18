import { describe, expect, it } from "vitest";

import { CHECKLIST_TABS, EDITOR_TABS, PROJECT_FORM_TABS, tabForField, tabFromHash, tabsWithErrors } from "@/lib/editor-tabs";

describe("Editor-Tabs", () => {
  it("ordnet Fehlerfelder dem richtigen Tab zu", () => {
    expect(tabForField("categoryId")).toBe("general");
    expect(tabForField("sourceUrl")).toBe("general");
    expect(tabForField("tags")).toBe("general");
    expect(tabForField("translations.de.title")).toBe("texts");
    expect(tabForField("requirements")).toBe("extras");
    expect(tabForField("requirements.2.url")).toBe("extras");
    expect(tabForField("contributors.0.name")).toBe("extras");
    // Nur ganze Feldnamen zählen, kein bloßer Präfix
    expect(tabForField("translationsX")).toBe("general");
  });

  it("liefert Tabs mit Fehlern ohne Doppelungen in Tab-Reihenfolge", () => {
    expect(tabsWithErrors(["contributors.0.name", "license", "translations.en.summary", "slug"])).toEqual([
      "general",
      "texts",
      "extras",
    ]);
    expect(tabsWithErrors([])).toEqual([]);
  });

  it("liest den Tab aus dem Anker nur, wenn er auf der Seite existiert", () => {
    expect(tabFromHash("#media", EDITOR_TABS)).toBe("media");
    expect(tabFromHash("versions", EDITOR_TABS)).toBe("versions");
    expect(tabFromHash("#media", PROJECT_FORM_TABS)).toBeNull();
    expect(tabFromHash("", EDITOR_TABS)).toBeNull();
    expect(tabFromHash("#section-general", EDITOR_TABS)).toBeNull();
  });

  it("verweist jeden Checklistenpunkt auf einen vorhandenen Tab", () => {
    for (const tab of Object.values(CHECKLIST_TABS)) expect(EDITOR_TABS).toContain(tab);
  });
});
