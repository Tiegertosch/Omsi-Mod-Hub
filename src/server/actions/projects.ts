"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { parseExternalUrl } from "@/lib/external-url";
import { codeFromForm, fieldErrorsFrom, type FormState } from "@/lib/form-state";
import { mediaKeyFromUrl, mediaUrlFromKey } from "@/lib/image-signature";
import {
  allowedDependencies,
  filledRequirements,
  projectFormSchema,
  readProjectForm,
  readVersionForm,
  versionFormSchema,
  type EditorErrorCode,
  type EditorFieldCode,
} from "@/lib/project-form";
import {
  generateDeletionCode,
  hashDeletionCode,
  normalizeDeletionCode,
  PROJECT_DELETION_CODE_MINUTES,
  projectDeletionIdentifier,
} from "@/lib/project-deletion";
import { isReviewRequired, PROJECT_LIMITS } from "@/lib/project-rules";
import {
  CREATOR_LOCKED_STATUSES,
  isEditableByCreator,
  nextStatusForCreator,
  publishChecklist,
} from "@/lib/project-status";
import { tokenizeQuery } from "@/lib/search-text";
import { isValidSlug, slugify } from "@/lib/slug";
import { pickTranslation } from "@/lib/translation";
import { canManageProjects } from "@/server/creator";
import { buildCatalogWhere } from "@/server/data/projects";
import { projectDeletionCodeEmail } from "@/server/emails";
import { processImageUpload } from "@/server/images";
import { sendMailInBackground } from "@/server/mail";
import { deleteProjectWithCode } from "@/server/project-deletion";
import { queueProjectUpdateMails } from "@/server/project-updates";
import { rebuildSearchText } from "@/server/project-search";
import { consumeRateLimit } from "@/server/rate-limit";
import { getActingUser, type CurrentUser } from "@/server/session";
import { deleteMedia, storeMedia } from "@/server/storage";
import { projectsChanged } from "@/server/public-cache";

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

/** Angemeldeter Nutzer mit Creator-Rechten und Zustimmung zu den Nutzungsbedingungen. */
async function currentCreator(): Promise<{ user: CurrentUser; error?: never } | { user?: never; error: EditorErrorCode }> {
  const acting = await getActingUser();
  if (!acting.ok) return { error: acting.reason };
  return canManageProjects(acting.user) ? { user: acting.user } : { error: "unauthorized" };
}

/** Lädt ein Projekt nur, wenn es dem Nutzer gehört. */
async function ownProject(user: CurrentUser, projectId: string) {
  if (!projectId || projectId.length > 64) return null;
  return db.project.findFirst({
    where: { id: projectId, creatorId: user.id },
    select: { id: true, slug: true, status: true, publishedAt: true, coverImageUrl: true },
  });
}

/**
 * Sperrt das Projekt bis zum Ende der Transaktion und prüft dabei erneut, ob es
 * dem Creator gehört und bearbeitbar ist. Die Prüfung über ownProject allein
 * reicht nicht: Ein Admin könnte das Projekt zwischen Lesen und Schreiben
 * ausblenden. Admin-Entscheidungen warten auf die Sperre und sehen danach den
 * neuen Stand. Muss die erste Schreibanweisung der Transaktion sein; bei
 * `false` wurde nichts geändert.
 */
async function lockEditable(
  tx: Prisma.TransactionClient,
  projectId: string,
  creatorId: string,
  data: Prisma.ProjectUncheckedUpdateManyInput = {},
) {
  const result = await tx.project.updateMany({
    where: { id: projectId, creatorId, status: { notIn: CREATOR_LOCKED_STATUSES } },
    data: { updatedAt: new Date(), ...data },
  });
  return result.count > 0;
}

/** Transaktion an einem bearbeitbaren Projekt; `null`, wenn es inzwischen gesperrt ist. */
function editProject<T>(
  projectId: string,
  creatorId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<{ value: T } | null> {
  return db.$transaction(async (tx) => {
    if (!(await lockEditable(tx, projectId, creatorId))) return null;
    return { value: await fn(tx) };
  });
}

async function audit(
  actorId: string,
  action: string,
  projectId: string,
  metadata?: Record<string, unknown>,
  client: Prisma.TransactionClient = db,
) {
  await client.auditLog.create({
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
  const { user, error } = await currentCreator();
  if (!user) return fail(error);
  if (!(await consumeRateLimit(`project-save:user:${user.id}`, 60, 10 * MINUTE))) return fail("rate_limit");

  const locale = z.enum(routing.locales).catch(routing.defaultLocale).parse(str(formData, "locale"));
  const projectId = str(formData, "projectId");
  const existing = projectId ? await ownProject(user, projectId) : null;
  if (projectId && !existing) return fail("not_found");
  if (existing && !isEditableByCreator(existing.status)) return fail("not_editable");

  const parsed = projectFormSchema.safeParse(readProjectForm(formData));
  if (!parsed.success) return fail("validation", fieldErrorsFrom<EditorFieldCode>(parsed.error));
  const data = parsed.data;

  const [category, categories, tags, dependencyTargets, existingDependencies] = await Promise.all([
    db.category.findUnique({ where: { id: data.categoryId }, select: { id: true } }),
    db.category.findMany({ select: { slug: true } }),
    db.tag.findMany({ where: { slug: { in: data.tags } }, select: { id: true } }),
    data.dependencies.length > 0
      ? db.project.findMany({ where: { id: { in: data.dependencies } }, select: { id: true, status: true } })
      : Promise.resolve([]),
    existing
      ? db.projectDependency.findMany({ where: { projectId: existing.id }, select: { dependsOnId: true } })
      : Promise.resolve([]),
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
  const requirements = filledRequirements(data.requirements);
  // Unbekannte und (neu gewählte) nicht veröffentlichte Projekte fallen still weg:
  // Die Suche bietet nur veröffentlichte an, Abweichungen entstehen nur, wenn
  // ein Ziel zwischen Auswahl und Speichern ausgeblendet wird.
  const dependencies = allowedDependencies(data.dependencies, {
    projectId: existing?.id ?? null,
    existing: new Set(existingDependencies.map((d) => d.dependsOnId)),
    targets: new Map(dependencyTargets.map((p) => [p.id, { published: p.status === "PUBLISHED" }])),
  });

  const core = {
    slug,
    categoryId: category.id,
    defaultLocale: data.defaultLocale,
    license: data.license,
    sourceUrl: data.sourceUrl,
    gameCompatibility: data.gameCompatibility,
    pricing: data.pricing,
  };

  const id = await db.$transaction(async (tx) => {
    let project: { id: string };
    if (existing) {
      if (!(await lockEditable(tx, existing.id, user.id, core))) return null;
      project = { id: existing.id };
    } else {
      project = await tx.project.create({ data: { ...core, creatorId: user.id, status: "DRAFT" }, select: { id: true } });
    }

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

    await tx.projectRequirement.deleteMany({ where: { projectId: project.id } });
    if (requirements.length > 0) {
      await tx.projectRequirement.createMany({
        data: requirements.map((r, index) => ({ projectId: project.id, ...r, sortOrder: index })),
      });
    }

    await tx.projectDependency.deleteMany({ where: { projectId: project.id } });
    if (dependencies.length > 0) {
      await tx.projectDependency.createMany({
        data: dependencies.map((dependsOnId, index) => ({ projectId: project.id, dependsOnId, sortOrder: index })),
      });
    }

    await rebuildSearchText(tx, project.id);
    return project.id;
  });
  if (!id) return fail("not_editable");

  if (!existing) {
    await audit(user.id, "project.create", id);
    // Nächster Schritt nach dem Anlegen: Bilder, danach Versionen.
    redirect(`/${locale}/dashboard/projects/${id}/edit#media`);
  }
  projectsChanged([slug]);
  refresh();
  return { status: "success" };
}

export type DependencyCandidate = { id: string; slug: string; title: string; creatorName: string };

/**
 * Suche im Editor nach Projekten, die das Projekt benötigt: nur veröffentlichte
 * (auch anderer Creator), ohne das Projekt selbst. Lesend, aber als Action,
 * weil der Editor eine Client-Komponente ist; eigenes Rate-Limit.
 */
export async function searchDependencyCandidatesAction(input: {
  projectId?: string;
  query: string;
  locale: string;
}): Promise<DependencyCandidate[]> {
  const { user } = await currentCreator();
  if (!user) return [];
  const query = typeof input.query === "string" ? input.query.slice(0, 100) : "";
  if (tokenizeQuery(query).length === 0) return [];
  if (!(await consumeRateLimit(`dependency-search:user:${user.id}`, 120, 10 * MINUTE))) return [];

  const locale = z.enum(routing.locales).catch(routing.defaultLocale).parse(input.locale);
  const projectId = typeof input.projectId === "string" && input.projectId.length <= 64 ? input.projectId : undefined;
  const rows = await db.project.findMany({
    where: { AND: [buildCatalogWhere({ q: query }), ...(projectId ? [{ id: { not: projectId } }] : [])] },
    orderBy: [{ outboundClickCount: "desc" }, { publishedAt: "desc" }],
    take: 8,
    select: {
      id: true,
      slug: true,
      defaultLocale: true,
      translations: { select: { locale: true, title: true } },
      creator: { select: { username: true, creatorProfile: { select: { displayName: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: pickTranslation(row.translations, locale, row.defaultLocale)?.translation.title ?? row.slug,
    creatorName: row.creator.creatorProfile?.displayName ?? row.creator.username,
  }));
}

// ---------------------------------------------------------------------------
// Bilder
// ---------------------------------------------------------------------------

const altSchema = z.string().trim().max(PROJECT_LIMITS.imageAlt, { message: "tooLong" });

async function editableProjectForUpload(formData: FormData) {
  const { user, error } = await currentCreator();
  if (!user) return { ok: false, error: fail(error) } as const;
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
  // Altes Titelbild erst unter der Sperre lesen, sonst bleibt bei parallelen
  // Uploads eine Datei verwaist.
  const previous = await editProject(ctx.project.id, ctx.user.id, async (tx) => {
    const current = await tx.project.findUniqueOrThrow({ where: { id: ctx.project.id }, select: { coverImageUrl: true } });
    await tx.project.update({
      where: { id: ctx.project.id },
      data: { coverImageUrl: mediaUrlFromKey(key), coverImageAlt: alt.data || null },
    });
    return current.coverImageUrl;
  });
  if (!previous) {
    await deleteMedia(key);
    return fail("not_editable");
  }
  await deleteMedia(mediaKeyFromUrl(previous.value));
  projectsChanged([ctx.project.slug]);
  refresh();
  return { status: "success" };
}

export async function removeCoverAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const ctx = await editableProjectForUpload(formData);
  if (!ctx.ok) return ctx.error;
  const previous = await editProject(ctx.project.id, ctx.user.id, async (tx) => {
    const current = await tx.project.findUniqueOrThrow({ where: { id: ctx.project.id }, select: { coverImageUrl: true } });
    await tx.project.update({ where: { id: ctx.project.id }, data: { coverImageUrl: null, coverImageAlt: null } });
    return current.coverImageUrl;
  });
  if (!previous) return fail("not_editable");
  await deleteMedia(mediaKeyFromUrl(previous.value));
  projectsChanged([ctx.project.slug]);
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
  // Unter der Sperre neu zählen, damit parallele Uploads das Limit nicht überschreiten.
  const created = await editProject(ctx.project.id, ctx.user.id, async (tx) => {
    const current = await tx.screenshot.count({ where: { projectId: ctx.project.id } });
    if (current >= PROJECT_LIMITS.screenshots) return false;
    await tx.screenshot.create({
      data: { projectId: ctx.project.id, imageUrl: mediaUrlFromKey(key), altText: alt.data, sortOrder: current },
    });
    return true;
  });
  if (!created?.value) {
    await deleteMedia(key);
    return fail(created ? "too_many_screenshots" : "not_editable");
  }
  projectsChanged([ctx.project.slug]);
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
  const deleted = await editProject(ctx.project.id, ctx.user.id, (tx) =>
    tx.screenshot.deleteMany({ where: { id: screenshot.id, projectId: ctx.project.id } }),
  );
  if (!deleted) return fail("not_editable");
  await deleteMedia(mediaKeyFromUrl(screenshot.imageUrl));
  projectsChanged([ctx.project.slug]);
  refresh();
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Versionen und Downloadlinks
// ---------------------------------------------------------------------------

export async function saveVersionAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const { user, error } = await currentCreator();
  if (!user) return fail(error);
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
  const saved = await editProject(project.id, user.id, async (tx) => {
    if (!existing) {
      const created = await tx.projectVersion.create({
        data: {
          projectId: project.id,
          version: data.version,
          changelog: data.changelog,
          releasedAt: now,
          links: {
            create: links.map(({ url, provider, label, sourceType, sortOrder }) => ({ url, provider, label, sourceType, sortOrder })),
          },
        },
        select: { id: true },
      });
      // Status unter der Sperre lesen: Nur neue Versionen veröffentlichter Projekte lösen Mails aus.
      const { status } = await tx.project.update({
        where: { id: project.id },
        data: { lastReleaseAt: now },
        select: { status: true },
      });
      return status === "PUBLISHED" ? created.id : null;
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
        // Klickzahlen und Status bleiben bei der Bearbeitung erhalten.
        await tx.externalLink.update({ where: { id: current.id }, data: link });
        if (current.url !== link.url) {
          // Neues Ziel: wieder ungeprüft, eine Defekt-Markierung entfällt. Gesperrte
          // Links bleiben gesperrt, bis ein Admin sie freigibt (sonst ließe sich die
          // Sperre per URL-Änderung umgehen). Bedingt in einer Anweisung, damit eine
          // gleichzeitige Sperre nicht überschrieben wird.
          await tx.externalLink.updateMany({
            where: { id: current.id, status: { not: "BLOCKED" } },
            data: { status: "UNCHECKED", lastCheckedAt: null, moderationNote: null },
          });
        }
      } else {
        const created = await tx.externalLink.create({ data: { ...link, versionId: existing.id }, select: { id: true } });
        keep.add(created.id);
      }
    }
    // Im Formular entfernte Links löschen.
    await tx.externalLink.deleteMany({ where: { versionId: existing.id, id: { notIn: [...keep] } } });
    return null;
  });
  if (!saved) return fail("not_editable");
  // Nach dem Commit: Mails an alle, die das Projekt gemerkt haben.
  if (saved.value) queueProjectUpdateMails(project.id, saved.value);

  projectsChanged([project.slug]);
  refresh();
  return { status: "success" };
}

export async function deleteVersionAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const { user, error } = await currentCreator();
  if (!user) return fail(error);
  const project = await ownProject(user, str(formData, "projectId"));
  if (!project) return fail("not_found");
  if (!isEditableByCreator(project.status)) return fail("not_editable");

  const version = await db.projectVersion.findFirst({
    where: { id: str(formData, "versionId"), projectId: project.id },
    select: { id: true },
  });
  if (!version) return fail("not_found");

  const result = await editProject(project.id, user.id, async (tx) => {
    // Status und Anzahl erst unter der Sperre lesen: Zwei parallele Löschungen
    // dürfen ein veröffentlichtes Projekt nicht ohne Version zurücklassen.
    const { status } = await tx.project.findUniqueOrThrow({ where: { id: project.id }, select: { status: true } });
    const count = await tx.projectVersion.count({ where: { projectId: project.id } });
    if (count <= 1 && status === "PUBLISHED") return "last_version" as const;

    await tx.projectVersion.delete({ where: { id: version.id } });
    const latest = await tx.projectVersion.findFirst({
      where: { projectId: project.id },
      orderBy: { releasedAt: "desc" },
      select: { releasedAt: true },
    });
    await tx.project.update({ where: { id: project.id }, data: { lastReleaseAt: latest?.releasedAt ?? null } });
    return "deleted" as const;
  });
  if (!result) return fail("not_editable");
  if (result.value === "last_version") return fail("last_version");
  projectsChanged([project.slug]);
  refresh();
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Status (Einreichen, Zurückziehen, Archivieren, Wiederherstellen)
// ---------------------------------------------------------------------------

const statusActionSchema = z.enum(["submit", "withdraw", "archive", "restore"]);

export async function changeProjectStatusAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const { user, error } = await currentCreator();
  if (!user) return fail(error);
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
  // Bedingtes Update auf den gelesenen Status: Hat ein Admin das Projekt
  // inzwischen ausgeblendet oder entschieden, darf der Creator das nicht
  // überschreiben (z. B. HIDDEN → ARCHIVED → DRAFT).
  const changed = await db.$transaction(async (tx) => {
    const result = await tx.project.updateMany({
      where: { id: project.id, creatorId: user.id, status: project.status },
      data: {
        status: next,
        ...(next === "PENDING_REVIEW" ? { submittedAt: now } : {}),
        ...(next === "PUBLISHED" ? { publishedAt: project.publishedAt ?? now, moderationNote: null } : {}),
      },
    });
    if (result.count === 0) return false;
    await audit(user.id, `project.${action.data}`, project.id, { from: project.status, to: next }, tx);
    return true;
  });
  if (!changed) return fail("invalid_transition");
  projectsChanged([project.slug]);
  refresh();
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Löschen (Bestätigung per Code aus der E-Mail, in jedem Status)
// ---------------------------------------------------------------------------

/** Schritt 1: Löschcode an die Adresse des Kontos senden. Ein neuer Code ersetzt den alten. */
export async function requestProjectDeletionAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const { user, error } = await currentCreator();
  if (!user) return fail(error);
  // Begrenzt zugleich die Zahl der Mails.
  if (!(await consumeRateLimit(`project-delete-request:user:${user.id}`, 3, 60 * MINUTE))) return fail("rate_limit");

  const projectId = str(formData, "projectId");
  if (!projectId || projectId.length > 64) return fail("not_found");
  const project = await db.project.findFirst({
    where: { id: projectId, creatorId: user.id },
    select: { id: true, slug: true, defaultLocale: true, translations: { select: { locale: true, title: true } } },
  });
  if (!project) return fail("not_found");

  const code = generateDeletionCode();
  const identifier = projectDeletionIdentifier(project.id);
  await db.$transaction([
    db.verification.deleteMany({ where: { identifier } }),
    db.verification.create({
      data: {
        identifier,
        value: hashDeletionCode(project.id, code),
        expiresAt: new Date(Date.now() + PROJECT_DELETION_CODE_MINUTES * MINUTE),
      },
    }),
  ]);

  const title =
    project.translations.find((t) => t.locale === project.defaultLocale)?.title ?? project.translations[0]?.title ?? project.slug;
  sendMailInBackground(projectDeletionCodeEmail(user, { id: project.id, title }, code, PROJECT_DELETION_CODE_MINUTES), {
    validMinutes: PROJECT_DELETION_CODE_MINUTES,
  });
  refresh();
  return { status: "success" };
}

/** Schritt 2: Code prüfen und das Projekt endgültig löschen. */
export async function confirmProjectDeletionAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const { user, error } = await currentCreator();
  if (!user) return fail(error);
  // Zusammen mit der Gültigkeit von 15 Minuten die Grenze für Rateversuche.
  if (!(await consumeRateLimit(`project-delete-confirm:user:${user.id}`, 5, 15 * MINUTE))) return fail("rate_limit");

  const locale = z.enum(routing.locales).catch(routing.defaultLocale).parse(str(formData, "locale"));
  const projectId = str(formData, "projectId");
  if (!projectId || projectId.length > 64) return fail("not_found");
  const code = normalizeDeletionCode(codeFromForm(formData));
  if (!code) return fail("validation", { code: "deletionCode" });

  let result;
  try {
    result = await deleteProjectWithCode({ projectId, creatorId: user.id, code });
  } catch (error) {
    console.error("[projects] Löschen fehlgeschlagen:", error instanceof Error ? error.message : "unbekannt");
    return fail("generic");
  }
  if (!result.ok) return result.reason === "invalid_code" ? fail("validation", { code: "deletionCode" }) : fail("not_found");

  // Nach dem Commit; schlägt das fehl, bleiben nur verwaiste Dateien zurück.
  await Promise.all(result.mediaUrls.map((url) => deleteMedia(mediaKeyFromUrl(url))));
  projectsChanged([result.slug]);
  redirect(`/${locale}/dashboard/projects?deleted=1`);
}
