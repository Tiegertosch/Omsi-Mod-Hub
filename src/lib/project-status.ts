import type { ProjectStatus } from "@/generated/prisma/enums";

/** Aktionen, die Creator an eigenen Projekten auslösen können. */
export type CreatorStatusAction = "submit" | "withdraw" | "archive" | "restore";

/**
 * Statusübergänge für Creator. HIDDEN (Moderation) und PENDING_REVIEW → PUBLISHED
 * bzw. → REJECTED sind Admins vorbehalten.
 */
export function nextStatusForCreator(
  current: ProjectStatus,
  action: CreatorStatusAction,
  options: { reviewRequired: boolean },
): ProjectStatus | null {
  switch (action) {
    case "submit":
      return current === "DRAFT" || current === "REJECTED"
        ? options.reviewRequired
          ? "PENDING_REVIEW"
          : "PUBLISHED"
        : null;
    case "withdraw":
      return current === "PENDING_REVIEW" ? "DRAFT" : null;
    case "archive":
      return current === "DRAFT" || current === "REJECTED" || current === "PUBLISHED" ? "ARCHIVED" : null;
    case "restore":
      return current === "ARCHIVED" ? "DRAFT" : null;
  }
}

export function availableCreatorActions(current: ProjectStatus, options: { reviewRequired: boolean }) {
  const actions: CreatorStatusAction[] = ["submit", "withdraw", "archive", "restore"];
  return actions.filter((action) => nextStatusForCreator(current, action, options) !== null);
}

/** Projekte in Prüfung oder in Moderation sind für Creator nicht bearbeitbar. */
export function isEditableByCreator(status: ProjectStatus): boolean {
  return status !== "PENDING_REVIEW" && status !== "HIDDEN";
}

export type ChecklistKey = "translation" | "category" | "license" | "version" | "link" | "cover";

export type ChecklistInput = {
  defaultLocale: string;
  license: string;
  categoryId: string | null;
  coverImageUrl: string | null;
  translations: { locale: string; title: string; summary: string; description: string }[];
  versions: { links: unknown[] }[];
};

/** Voraussetzungen für eine Einreichung; `cover` ist empfohlen, aber nicht Pflicht. */
export function publishChecklist(project: ChecklistInput) {
  const main = project.translations.find((t) => t.locale === project.defaultLocale);
  const items: { key: ChecklistKey; ok: boolean; required: boolean }[] = [
    {
      key: "translation",
      ok: Boolean(main && main.title.trim() && main.summary.trim() && main.description.trim()),
      required: true,
    },
    { key: "category", ok: Boolean(project.categoryId), required: true },
    { key: "license", ok: project.license.trim().length > 0, required: true },
    { key: "version", ok: project.versions.length > 0, required: true },
    { key: "link", ok: project.versions.some((v) => v.links.length > 0), required: true },
    { key: "cover", ok: Boolean(project.coverImageUrl), required: false },
  ];
  return { items, ready: items.every((item) => item.ok || !item.required) };
}
