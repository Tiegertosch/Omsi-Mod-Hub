import { z } from "zod";

import { LinkSourceType, RequirementPricing } from "@/generated/prisma/enums";
import { routing, type AppLocale } from "@/i18n/routing";

import { MAX_EXTERNAL_URL_LENGTH, parseExternalUrl } from "./external-url";
import { PROJECT_LIMITS, VERSION_PATTERN } from "./project-rules";
import { SLUG_MAX } from "./slug";

/** Fehlercodes des Editors; Texte unter Editor.errors bzw. Editor.fieldErrors. */
export type EditorErrorCode =
  | "validation"
  | "unauthorized"
  | "not_found"
  | "not_editable"
  | "rate_limit"
  | "checklist"
  | "invalid_transition"
  | "upload_failed"
  | "too_many_screenshots"
  | "last_version"
  | "terms_required"
  | "generic";

export type EditorFieldCode =
  | "required"
  | "tooLong"
  | "slug"
  | "slugTaken"
  | "url"
  | "category"
  | "locale"
  | "tooMany"
  | "version"
  | "versionTaken"
  | "linksRequired"
  | "imageType"
  | "imageSize"
  | "imageDimensions";

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/** Liest nummerierte Zeilen wie "links.0.url" in der Reihenfolge ihrer Indizes. */
function readRows<K extends string>(formData: FormData, prefix: string, fields: readonly K[]) {
  const indices = new Set<number>();
  const pattern = new RegExp(`^${prefix}\\.(\\d{1,2})\\.`);
  for (const key of formData.keys()) {
    const match = pattern.exec(key);
    if (match) indices.add(Number(match[1]));
  }
  return [...indices]
    .sort((a, b) => a - b)
    .map((index) => Object.fromEntries(fields.map((f) => [f, str(formData, `${prefix}.${index}.${f}`)])) as Record<K, string>);
}

const text = (max: number) => z.string().trim().max(max, { message: "tooLong" });
const optionalText = (max: number) =>
  text(max).transform((value) => (value.length > 0 ? value : null));

const optionalUrl = z
  .string()
  .trim()
  .max(MAX_EXTERNAL_URL_LENGTH, { message: "url" })
  .refine((value) => value.length === 0 || parseExternalUrl(value).ok, { message: "url" })
  .transform((value) => {
    if (!value) return null;
    const parsed = parseExternalUrl(value);
    return parsed.ok ? parsed.url : null;
  });

// ---------------------------------------------------------------------------
// Projektdaten
// ---------------------------------------------------------------------------

const translationSchema = z.object({
  title: text(PROJECT_LIMITS.title),
  summary: text(PROJECT_LIMITS.summary),
  description: text(PROJECT_LIMITS.description),
  installation: optionalText(PROJECT_LIMITS.installation),
});

const REQUIRED_TRANSLATION_FIELDS = ["title", "summary", "description"] as const;

export const projectFormSchema = z
  .object({
    categoryId: z.string().min(1, { message: "category" }).max(64, { message: "category" }),
    defaultLocale: z.enum(routing.locales, { message: "locale" }),
    slug: z.string().trim().toLowerCase().max(SLUG_MAX, { message: "slug" }),
    license: text(PROJECT_LIMITS.license).min(1, { message: "required" }),
    sourceUrl: optionalUrl,
    gameCompatibility: optionalText(PROJECT_LIMITS.gameCompatibility),
    translations: z.object(
      Object.fromEntries(routing.locales.map((l) => [l, translationSchema])) as Record<
        AppLocale,
        typeof translationSchema
      >,
    ),
    tags: z.array(z.string().max(64)).max(PROJECT_LIMITS.tags, { message: "tooMany" }),
    contributors: z
      .array(
        z.object({
          name: text(PROJECT_LIMITS.contributorName),
          role: optionalText(PROJECT_LIMITS.contributorRole),
        }),
      )
      .max(PROJECT_LIMITS.contributors, { message: "tooMany" }),
    // Voraussetzungen: Name Pflicht, Link optional (geprüft wie Downloadlinks).
    requirements: z
      .array(
        z.object({
          name: text(PROJECT_LIMITS.requirementName),
          url: z.string().trim().max(MAX_EXTERNAL_URL_LENGTH, { message: "url" }),
          pricing: z.enum(RequirementPricing).catch("FREEWARE"),
        }),
      )
      .max(PROJECT_LIMITS.requirements, { message: "tooMany" }),
  })
  .superRefine((data, ctx) => {
    for (const locale of routing.locales) {
      const t = data.translations[locale];
      const filled = Boolean(t.title || t.summary || t.description || t.installation);
      // Originalsprache ist Pflicht; weitere Sprachen nur, wenn begonnen.
      if (locale !== data.defaultLocale && !filled) continue;
      for (const field of REQUIRED_TRANSLATION_FIELDS) {
        if (!t[field]) ctx.addIssue({ code: "custom", path: ["translations", locale, field], message: "required" });
      }
    }
    data.contributors.forEach((row, index) => {
      if (!row.name && row.role) {
        ctx.addIssue({ code: "custom", path: ["contributors", index, "name"], message: "required" });
      }
    });
    data.requirements.forEach((row, index) => {
      if (!row.name && row.url) {
        ctx.addIssue({ code: "custom", path: ["requirements", index, "name"], message: "required" });
      }
      if (row.url && !parseExternalUrl(row.url).ok) {
        ctx.addIssue({ code: "custom", path: ["requirements", index, "url"], message: "url" });
      }
    });
  });

/** Ausgefüllte Voraussetzungen mit normalisiertem Link (leere Zeilen fallen weg). */
export function filledRequirements(rows: ProjectFormData["requirements"]) {
  return rows
    .filter((row) => row.name)
    .map((row) => {
      const parsed = row.url ? parseExternalUrl(row.url) : null;
      return { name: row.name, url: parsed?.ok ? parsed.url : null, pricing: row.pricing };
    });
}

export type ProjectFormData = z.infer<typeof projectFormSchema>;

export function readProjectForm(formData: FormData) {
  return {
    categoryId: str(formData, "categoryId"),
    defaultLocale: str(formData, "defaultLocale"),
    slug: str(formData, "slug"),
    license: str(formData, "license"),
    sourceUrl: str(formData, "sourceUrl"),
    gameCompatibility: str(formData, "gameCompatibility"),
    translations: Object.fromEntries(
      routing.locales.map((l) => [
        l,
        {
          title: str(formData, `translations.${l}.title`),
          summary: str(formData, `translations.${l}.summary`),
          description: str(formData, `translations.${l}.description`),
          installation: str(formData, `translations.${l}.installation`),
        },
      ]),
    ),
    tags: [...new Set(formData.getAll("tags").filter((v): v is string => typeof v === "string"))],
    contributors: readRows(formData, "contributors", ["name", "role"] as const),
    requirements: readRows(formData, "requirements", ["name", "url", "pricing"] as const),
  };
}

// ---------------------------------------------------------------------------
// Versionen und Downloadlinks
// ---------------------------------------------------------------------------

export const versionFormSchema = z
  .object({
    version: text(PROJECT_LIMITS.version)
      .min(1, { message: "required" })
      .regex(VERSION_PATTERN, { message: "version" }),
    changelog: optionalText(PROJECT_LIMITS.changelog),
    links: z
      .array(
        z.object({
          id: z.string().max(64),
          url: z.string().trim().max(MAX_EXTERNAL_URL_LENGTH, { message: "url" }),
          label: optionalText(PROJECT_LIMITS.linkLabel),
          sourceType: z.enum(LinkSourceType).catch("FILE_HOSTER"),
        }),
      )
      .max(PROJECT_LIMITS.linksPerVersion, { message: "tooMany" }),
  })
  .superRefine((data, ctx) => {
    let count = 0;
    data.links.forEach((link, index) => {
      if (!link.url && !link.label) return;
      if (!link.url || !parseExternalUrl(link.url).ok) {
        ctx.addIssue({ code: "custom", path: ["links", index, "url"], message: "url" });
      }
      count += 1;
    });
    if (count === 0) ctx.addIssue({ code: "custom", path: ["links"], message: "linksRequired" });
  });

export type VersionFormData = z.infer<typeof versionFormSchema>;

export function readVersionForm(formData: FormData) {
  return {
    version: str(formData, "version"),
    changelog: str(formData, "changelog"),
    links: readRows(formData, "links", ["id", "url", "label", "sourceType"] as const),
  };
}

// ---------------------------------------------------------------------------
// Creator-Profil
// ---------------------------------------------------------------------------

export const creatorProfileSchema = z.object({
  displayName: text(50).min(1, { message: "required" }),
  bio: optionalText(1000),
  websiteUrl: optionalUrl,
});

export function readCreatorProfileForm(formData: FormData) {
  return {
    displayName: str(formData, "displayName"),
    bio: str(formData, "bio"),
    websiteUrl: str(formData, "websiteUrl"),
  };
}
