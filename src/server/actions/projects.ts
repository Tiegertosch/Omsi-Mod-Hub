"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ProjectStatus } from "@/generated/prisma/enums";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { parseExternalUrl } from "@/lib/external-url";
import { fieldErrorsFrom, type FormState } from "@/lib/form-state";
import { mediaKeyFromUrl, mediaUrlFromKey } from "@/lib/image-signature";
import {
  projectFormSchema,
  readProjectForm,
  readVersionForm,
  versionFormSchema,
  type EditorErrorCode,
  type EditorFieldCode,
} from "@/lib/project-form";
import { isReviewRequired, PROJECT_LIMITS } from "@/lib/project-rules";
import { isEditableByCreator, nextStatusForCreator, publishChecklist } from "@/lib/project-status";
import { isValidSlug, slugify } from "@/lib/slug";
import { canManageProjects } from "@/server/creator";
import { processImageUpload } from "@/server/images";
import { rebuildSearchText } from "@/server/project-search";
import { consumeRateLimit } from "@/server/rate-limit";
import { getCurrentUser, type CurrentUser } from "@/server/session";
import { deleteMedia, storeMedia } from "@/server/storage";

type EditorState = FormState<EditorErrorCode, EditorFieldCode>;

const MINUTE = 60 * 1000;
const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};
const fail = (code: EditorErrorCode, fieldErrors?: Record<string, EditorFieldCode>): EditorState => ({
  status: "error",
  code,
  fieldErrors,
});

/** Angemeldeter Nutzer mit Creator-Rechten oder null. */
async function currentCreator(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user && canManageProjects(user) ? user : null;
}

/** Lädt ein Projekt nur, wenn es dem Nutzer gehört. */
async function ownProject(user: CurrentUser, projectId: string) {
  if (!projectId || projectId.length > 64) return null;
  return db.project.findFirst({
    where: { id: projectId, creatorId: user.id },
    select: { id: true, slug: true, status: true, publishedAt: true, coverImageUrl: true },
  });
}

async function audit(actorId: string, action: string, projectId: string, metadata?: Record<string, unknown>) {
  await db.auditLog.create({
    data: {
      actorId,
      action,
      entityType: "Project",
      entityId: projectId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// Projektdaten anlegen / speichern
// ---------------------------------------------------------------------------

async function uniqueSlug(base: string, excludeId: string | null, reserved: Set<string>) {
  const root = base.length >= 3 ? base : `${base || "projekt"}-mod`.replace(/^-/, "");
  for (let i = 1; i < 100; i++) {
    const candidate = i === 1 ? root : `${root.slice(0, 75)}-${i}`;
    if (reserved.has(candidate)) continue;
    const clash = await db.project.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return `${root.slice(0, 60)}-${Date.now().toString(36)}`;
}

export async function saveProjectAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const user = await currentCreator();
  if (!user) return fail("unauthorized");
  if (!(await consumeRateLimit(`project-save:user:${user.id}`, 60, 10 * MINUTE))) return fail("rate_limit");

  const locale = z.enum(routing.locales).catch(routing.defaultLocale).parse(str(formData, "locale"));
  const projectId = str(formData, "projectId");
  const existing = projectId ? await ownProject(user, projectId) : null;
  if (projectId && !existing) return fail("not_found");
  if (existing && !isEditableByCreator(existing.status)) return fail("not_editable");

  const parsed = projectFormSchema.safeParse(readProjectForm(formData));
  if (!parsed.success) return fail("validation", fieldErrorsFrom<EditorFieldCode>(parsed.error));
  const data = parsed.data;

  const [category, categories, tags] = await Promise.all([
    db.category.findUnique({ where: { id: data.categoryId }, select: { id: true } }),
    db.category.findMany({ select: { slug: true } }),
    db.tag.findMany({ where: { slug: { in: data.tags } }, select: { id: true } }),
  ]);
  if (!category) return fail("validation", { categoryId: "category" });

  // Slug: nach der ersten Veröffentlichung unveränderlich (stabile URLs).
  const reserved = new Set(categories.map((c) => c.slug));
  let slug: string;
  if (existing?.publishedAt) {
    slug = existing.slug;
  } else if (data.slug) {
    if (!isValidSlug(data.slug) || reserved.has(data.slug)) return fail("validation", { slug: "slug" });
    const clash = await db.project.findFirst({
      where: { slug: data.slug, ...(existing ? { id: { not: existing.id } } : {}) },
      select: { id: true },
    });
    if (clash) return fail("validation", { slug: "slugTaken" });
    slug = data.slug;
  } else {
    slug = await uniqueSlug(slugify(data.translations[data.defaultLocale].title), existing?.id ?? null, reserved);
  }

  const translations = routing.locales
    .map((l) => ({ locale: l, ...data.translations[l] }))
    .filter((t) => t.locale === data.defaultLocale || t.title);
  const contributors = data.contributors.filter((c) => c.name);

  const core = {
    slug,
    categoryId: category.id,
    defaultLocale: data.defaultLocale,
    license: data.license,
    sourceUrl: data.sourceUrl,
    gameCompatibility: data.gameCompatibility,
  };

  const id = await db.$transaction(async (tx) => {
    const project = existing
      ? await tx.project.update({ where: { id: existing.id }, data: core, select: { id: true } })
      : await tx.project.create({ data: { ...core, creatorId: user.id, status: "DRAFT" }, select: { id: true } });

    // Übersetzungen: vorhandene aktualisieren, neue anlegen, geleerte entfernen.
    await tx.projectTranslation.deleteMany({
      where: { projectId: project.id, locale: { notIn: translations.map((t) => t.locale) } },
    });
    for (const t of translations) {
      const values = {
        title: t.title,
        summary: t.summary,
        description: t.description,
        installation: t.installation,
        requirements: t.requirements,
      };
      await tx.projectTranslation.upsert({
        where: { projectId_locale: { projectId: project.id, locale: t.locale } },
        update: values,
        create: { ...values, projectId: project.id, locale: t.locale, searchText: "" },
      });
    }

    await tx.projectTag.deleteMany({ where: { projectId: project.id } });
    if (tags.length > 0) {
      await tx.projectTag.createMany({ data: tags.map((tag) => ({ projectId: project.id, tagId: tag.id })) });
    }

    await tx.projectContributor.deleteMany({ where: { projectId: project.id } });
    if (contributors.length > 0) {
      await tx.projectContributor.createMany({
        data: contributors.map((c, index) => ({ projectId: project.id, name: c.name, role: c.role, sortOrder: index })),
      });
    }

    await rebuildSearchText(tx, project.id);
    return project.id;
  });

  if (!existing) {
    await audit(user.id, "project.create", id);
    redirect(`/${locale}/dashboard/projects/${id}/edit`);
  }
  refresh();
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Bilder
// ---------------------------------------------------------------------------

const altSchema = z.string().trim().max(PROJECT_LIMITS.imageAlt, { message: "tooLong" });

async function editableProjectForUpload(formData: FormData) {
  const user = await currentCreator();
  if (!user) return { ok: false, error: fail("unauthorized") } as const;
  if (!(await consumeRateLimit(`upload:user:${user.id}`, 30, 10 * MINUTE))) return { ok: false, error: fail("rate_limit") } as const;
  const project = await ownProject(user, str(formData, "projectId"));
  if (!project) return { ok: false, error: fail("not_found") } as const;
  if (!isEditableByCreator(project.status)) return { ok: false, error: fail("not_editable") } as const;
  return { ok: true, user, project } as const;
}

export async function uploadCoverAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const ctx = await editableProjectForUpload(formData);
  if (!ctx.ok) return ctx.error;

  const alt = altSchema.safeParse(str(formData, "alt"));
  if (!alt.success) return fail("validation", { alt: "tooLong" });

  const image = await processImageUpload(formData.get("file"));
  if (!image.ok) return fail("validation", { file: image.error });

  const key = await storeMedia(image.data);
  await db.project.update({
    where: { id: ctx.project.id },
    data: { coverImageUrl: mediaUrlFromKey(key), coverImageAlt: alt.data || null },
  });
  await deleteMedia(mediaKeyFromUrl(ctx.project.coverImageUrl));
  refresh();
  return { status: "success" };
}

export async function removeCoverAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const ctx = await editableProjectForUpload(formData);
  if (!ctx.ok) return ctx.error;
  await db.project.update({ where: { id: ctx.project.id }, data: { coverImageUrl: null, coverImageAlt: null } });
  await deleteMedia(mediaKeyFromUrl(ctx.project.coverImageUrl));
  refresh();
  return { status: "success" };
}

export async function uploadScreenshotAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const ctx = await editableProjectForUpload(formData);
  if (!ctx.ok) return ctx.error;

  const alt = altSchema.min(1, { message: "required" }).safeParse(str(formData, "alt"));
  if (!alt.success) return fail("validation", { alt: alt.error.issues[0]?.message === "required" ? "required" : "tooLong" });

  const count = await db.screenshot.count({ where: { projectId: ctx.project.id } });
  if (count >= PROJECT_LIMITS.screenshots) return fail("too_many_screenshots");

  const image = await processImageUpload(formData.get("file"));
  if (!image.ok) return fail("validation", { file: image.error });

  const key = await storeMedia(image.data);
  await db.screenshot.create({
    data: { projectId: ctx.project.id, imageUrl: mediaUrlFromKey(key), altText: alt.data, sortOrder: count },
  });
  refresh();
  return { status: "success" };
}

export async function deleteScreenshotAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const ctx = await editableProjectForUpload(formData);
  if (!ctx.ok) return ctx.error;
  const screenshot = await db.screenshot.findFirst({
    where: { id: str(formData, "screenshotId"), projectId: ctx.project.id },
  });
  if (!screenshot) return fail("not_found");
  await db.screenshot.delete({ where: { id: screenshot.id } });
  await deleteMedia(mediaKeyFromUrl(screenshot.imageUrl));
  refresh();
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Versionen und Downloadlinks
// ---------------------------------------------------------------------------

export async function saveVersionAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const user = await currentCreator();
  if (!user) return fail("unauthorized");
  if (!(await consumeRateLimit(`version-save:user:${user.id}`, 60, 10 * MINUTE))) return fail("rate_limit");

  const project = await ownProject(user, str(formData, "projectId"));
  if (!project) return fail("not_found");
  if (!isEditableByCreator(project.status)) return fail("not_editable");

  const versionId = str(formData, "versionId");
  const existing = versionId
    ? await db.projectVersion.findFirst({
        where: { id: versionId, projectId: project.id },
        include: { links: { select: { id: true, url: true } } },
      })
    : null;
  if (versionId && !existing) return fail("not_found");

  const parsed = versionFormSchema.safeParse(readVersionForm(formData));
  if (!parsed.success) return fail("validation", fieldErrorsFrom<EditorFieldCode>(parsed.error));
  const data = parsed.data;

  const clash = await db.projectVersion.findFirst({
    where: { projectId: project.id, version: data.version, ...(existing ? { id: { not: existing.id } } : {}) },
    select: { id: true },
  });
  if (clash) return fail("validation", { version: "versionTaken" });

  if (!existing) {
    const count = await db.projectVersion.count({ where: { projectId: project.id } });
    if (count >= PROJECT_LIMITS.versions) return fail("validation", { version: "tooMany" });
  }

  // Nur vollständige Zeilen speichern; URL normalisieren, Anbieter serverseitig ableiten.
  const links = data.links
    .filter((link) => link.url)
    .map((link, index) => {
      const parsedUrl = parseExternalUrl(link.url);
      if (!parsedUrl.ok) throw new Error("URL wurde bereits validiert.");
      return { id: link.id, url: parsedUrl.url, provider: parsedUrl.provider, label: link.label, sourceType: link.sourceType, sortOrder: index };
    });

  const now = new Date();
  await db.$transaction(async (tx) => {
    if (!existing) {
      await tx.projectVersion.create({
        data: {
          projectId: project.id,
          version: data.version,
          changelog: data.changelog,
          releasedAt: now,
          links: {
            create: links.map(({ url, provider, label, sourceType, sortOrder }) => ({ url, provider, label, sourceType, sortOrder })),
          },
        },
      });
      await tx.project.update({ where: { id: project.id }, data: { lastReleaseAt: now } });
      return;
    }

    await tx.projectVersion.update({
      where: { id: existing.id },
      data: { version: data.version, changelog: data.changelog },
    });
    const known = new Map(existing.links.map((link) => [link.id, link]));
    const keep = new Set<string>();
    for (const { id, ...link } of links) {
      const current = id ? known.get(id) : undefined;
      if (current) {
        keep.add(current.id);
        await tx.externalLink.update({
          where: { id: current.id },
          // Geänderte Ziele gelten wieder als ungeprüft; Klickzahlen bleiben erhalten.
          data: current.url === link.url ? link : { ...link, status: "UNCHECKED", lastCheckedAt: null },
        });
      } else {
        const created = await tx.externalLink.create({ data: { ...link, versionId: existing.id }, select: { id: true } });
        keep.add(created.id);
      }
    }
    // Im Formular entfernte Links löschen.
    await tx.externalLink.deleteMany({ where: { versionId: existing.id, id: { notIn: [...keep] } } });
  });

  refresh();
  return { status: "success" };
}

export async function deleteVersionAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const user = await currentCreator();
  if (!user) return fail("unauthorized");
  const project = await ownProject(user, str(formData, "projectId"));
  if (!project) return fail("not_found");
  if (!isEditableByCreator(project.status)) return fail("not_editable");

  const version = await db.projectVersion.findFirst({
    where: { id: str(formData, "versionId"), projectId: project.id },
    select: { id: true },
  });
  if (!version) return fail("not_found");

  const count = await db.projectVersion.count({ where: { projectId: project.id } });
  if (count <= 1 && project.status === "PUBLISHED") return fail("last_version");

  await db.$transaction(async (tx) => {
    await tx.projectVersion.delete({ where: { id: version.id } });
    const latest = await tx.projectVersion.findFirst({
      where: { projectId: project.id },
      orderBy: { releasedAt: "desc" },
      select: { releasedAt: true },
    });
    await tx.project.update({ where: { id: project.id }, data: { lastReleaseAt: latest?.releasedAt ?? null } });
  });
  refresh();
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Status (Einreichen, Zurückziehen, Archivieren, Wiederherstellen)
// ---------------------------------------------------------------------------

const statusActionSchema = z.enum(["submit", "withdraw", "archive", "restore"]);

export async function changeProjectStatusAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const user = await currentCreator();
  if (!user) return fail("unauthorized");
  const action = statusActionSchema.safeParse(str(formData, "action"));
  if (!action.success) return fail("invalid_transition");

  const project = await db.project.findFirst({
    where: { id: str(formData, "projectId"), creatorId: user.id },
    include: {
      translations: { select: { locale: true, title: true, summary: true, description: true } },
      versions: { select: { links: { select: { id: true } } } },
    },
  });
  if (!project) return fail("not_found");

  const reviewRequired = isReviewRequired();
  const next: ProjectStatus | null = nextStatusForCreator(project.status, action.data, { reviewRequired });
  if (!next) return fail("invalid_transition");
  if (action.data === "submit" && !publishChecklist(project).ready) return fail("checklist");

  const now = new Date();
  await db.project.update({
    where: { id: project.id },
    data: {
      status: next,
      ...(next === "PENDING_REVIEW" ? { submittedAt: now } : {}),
      ...(next === "PUBLISHED" ? { publishedAt: project.publishedAt ?? now, moderationNote: null } : {}),
    },
  });
  await audit(user.id, `project.${action.data}`, project.id, { from: project.status, to: next });
  refresh();
  return { status: "success" };
}
