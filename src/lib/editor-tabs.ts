import type { ChecklistKey } from "@/lib/project-status";

/**
 * Tabs des Projekt-Editors. Die ersten drei gehören zum Projektformular
 * (gemeinsamer Speichern-Button), Bilder und Versionen speichern sofort mit
 * eigenen Formularen. Die ID steht als Anker in der Adresse (z. B. #media).
 */
export const EDITOR_TABS = ["general", "texts", "extras", "media", "versions"] as const;
export type EditorTabId = (typeof EDITOR_TABS)[number];

export const PROJECT_FORM_TABS = ["general", "texts", "extras"] as const satisfies readonly EditorTabId[];

function belongsTo(field: string, root: string) {
  return field === root || field.startsWith(`${root}.`);
}

/** In welchem Tab ein Feld des Projektformulars liegt (Schlüssel wie in `fieldErrors`). */
export function tabForField(field: string): EditorTabId {
  if (belongsTo(field, "translations")) return "texts";
  if (belongsTo(field, "requirements") || belongsTo(field, "contributors")) return "extras";
  return "general";
}

/** Tabs mit fehlerhaften Feldern, in Tab-Reihenfolge. */
export function tabsWithErrors(fields: Iterable<string>): EditorTabId[] {
  const tabs = new Set([...fields].map(tabForField));
  return EDITOR_TABS.filter((tab) => tabs.has(tab));
}

/** Tab aus dem Anker der Adresse, sofern auf dieser Seite vorhanden. */
export function tabFromHash(hash: string, available: readonly EditorTabId[]): EditorTabId | null {
  const id = hash.replace(/^#/, "");
  return available.find((tab) => tab === id) ?? null;
}

/** Wo sich ein Punkt der Einreichungs-Checkliste erledigen lässt. */
export const CHECKLIST_TABS: Record<ChecklistKey, EditorTabId> = {
  translation: "texts",
  category: "general",
  license: "general",
  version: "versions",
  link: "versions",
  cover: "media",
};
