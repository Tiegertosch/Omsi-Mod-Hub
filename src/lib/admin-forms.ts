import { z } from "zod";

import { routing, type AppLocale } from "@/i18n/routing";

import { isBanDuration } from "./moderation";
import { PROJECT_LIMITS } from "./project-rules";
import { isValidSlug } from "./slug";

/** Fehlercodes der Admin-Formulare; Texte unter Admin.errors bzw. Admin.fieldErrors. */
export type AdminErrorCode =
  | "validation"
  | "unauthorized"
  | "not_found"
  | "invalid_transition"
  | "forbidden_target"
  | "in_use"
  | "rate_limit"
  | "generic";

export type AdminFieldCode = "required" | "tooLong" | "slug" | "slugTaken" | "icon" | "number" | "duration";

export const ADMIN_LIMITS = {
  categoryName: 60,
  categoryDescription: 300,
  tagName: 40,
  banReason: 300,
  reportNote: 1_000,
  sortOrder: 9_999,
} as const;

/** Verfügbare Icons für Kategorien (lucide); die Zuordnung steht in category-icon.tsx. */
export const CATEGORY_ICON_NAMES = ["bus", "map", "paintbrush", "boxes", "audio-lines", "wrench"] as const;
export type CategoryIconName = (typeof CATEGORY_ICON_NAMES)[number];

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const requiredText = (max: number) =>
  z.string().trim().min(1, { message: "required" }).max(max, { message: "tooLong" });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: "tooLong" })
    .transform((value) => (value.length > 0 ? value : null));

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => isValidSlug(value), { message: "slug" });

function perLocale<T extends z.ZodType>(schema: T) {
  return z.object(Object.fromEntries(routing.locales.map((l) => [l, schema])) as Record<AppLocale, T>);
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

export const categoryFormSchema = z.object({
  /** leer beim Bearbeiten: Slugs bleiben stabil, weil sie in URLs stehen */
  slug: slugSchema.optional(),
  icon: z
    .string()
    .transform((value) => (value.length > 0 ? value : null))
    .refine((value) => value === null || (CATEGORY_ICON_NAMES as readonly string[]).includes(value), {
      message: "icon",
    }),
  sortOrder: z.coerce
    .number({ message: "number" })
    .int({ message: "number" })
    .min(0, { message: "number" })
    .max(ADMIN_LIMITS.sortOrder, { message: "number" }),
  translations: perLocale(
    z.object({
      name: requiredText(ADMIN_LIMITS.categoryName),
      description: optionalText(ADMIN_LIMITS.categoryDescription),
    }),
  ),
});

export type CategoryFormData = z.infer<typeof categoryFormSchema>;

export function readCategoryForm(formData: FormData, { withSlug }: { withSlug: boolean }) {
  return {
    ...(withSlug ? { slug: str(formData, "slug") } : {}),
    icon: str(formData, "icon"),
    sortOrder: str(formData, "sortOrder") || "0",
    translations: Object.fromEntries(
      routing.locales.map((l) => [
        l,
        { name: str(formData, `translations.${l}.name`), description: str(formData, `translations.${l}.description`) },
      ]),
    ),
  };
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const tagFormSchema = z.object({
  slug: slugSchema.optional(),
  translations: perLocale(z.object({ name: requiredText(ADMIN_LIMITS.tagName) })),
});

export type TagFormData = z.infer<typeof tagFormSchema>;

export function readTagForm(formData: FormData, { withSlug }: { withSlug: boolean }) {
  return {
    ...(withSlug ? { slug: str(formData, "slug") } : {}),
    translations: Object.fromEntries(routing.locales.map((l) => [l, { name: str(formData, `translations.${l}.name`) }])),
  };
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export const banFormSchema = z.object({
  reason: requiredText(ADMIN_LIMITS.banReason),
  duration: z.string().refine(isBanDuration, { message: "duration" }),
  hideProjects: z.boolean(),
});

export function readBanForm(formData: FormData) {
  return {
    reason: str(formData, "reason"),
    duration: str(formData, "duration"),
    hideProjects: formData.get("hideProjects") === "on",
  };
}

export const reportNoteSchema = optionalText(ADMIN_LIMITS.reportNote);

export const moderationNoteSchema = requiredText(PROJECT_LIMITS.moderationNote);
