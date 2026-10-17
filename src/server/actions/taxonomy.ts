"use server";

import { refresh } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { categoryFormSchema, readCategoryForm, readTagForm, tagFormSchema } from "@/lib/admin-forms";
import { db } from "@/lib/db";
import { fieldErrorsFrom } from "@/lib/form-state";
import { routing } from "@/i18n/routing";
import { adminActor, adminFail, adminIdSchema, type AdminState } from "@/server/admin-action";
import { rebuildSearchText } from "@/server/project-search";
import { taxonomyChanged } from "@/server/public-cache";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function audit(actorId: string, action: string, entityType: string, entityId: string, metadata?: object) {
  return {
    data: { actorId, action, entityType, entityId, metadata: metadata ? JSON.stringify(metadata) : null },
  };
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

/**
 * Legt eine Kategorie an (ohne `categoryId`) oder bearbeitet sie. Der Slug ist
 * nach dem Anlegen fest, weil er in /mods/[slug] steht. Da Kategorien dort
 * Vorrang vor Projekten haben, darf er auch keinem Projekt-Slug entsprechen.
 */
export async function saveCategoryAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await adminActor();
  if (!actor.ok) return actor.state;

  const rawId = formData.get("categoryId");
  const isNew = !rawId;
  const parsed = categoryFormSchema.safeParse(readCategoryForm(formData, { withSlug: isNew }));
  if (!parsed.success) return adminFail("validation", fieldErrorsFrom(parsed.error));
  const data = parsed.data;

  const translations = routing.locales.map((locale) => ({ locale, ...data.translations[locale] }));

  if (isNew) {
    if (!data.slug) return adminFail("validation", { slug: "slug" });
    const [category, project] = await Promise.all([
      db.category.findUnique({ where: { slug: data.slug }, select: { id: true } }),
      db.project.findUnique({ where: { slug: data.slug }, select: { id: true } }),
    ]);
    if (category || project) return adminFail("validation", { slug: "slugTaken" });
    try {
      await db.$transaction(async (tx) => {
        const row = await tx.category.create({
          data: { slug: data.slug!, icon: data.icon, sortOrder: data.sortOrder, translations: { create: translations } },
        });
        await tx.auditLog.create(audit(actor.admin.id, "category.create", "Category", row.id, { slug: row.slug }));
      });
    } catch (error) {
      if (isUniqueViolation(error)) return adminFail("validation", { slug: "slugTaken" });
      throw error;
    }
    taxonomyChanged();
  refresh();
    return { status: "success" };
  }

  const id = adminIdSchema.safeParse(rawId);
  if (!id.success) return adminFail("not_found");
  const existing = await db.category.findUnique({ where: { id: id.data }, select: { id: true } });
  if (!existing) return adminFail("not_found");

  await db.$transaction(async (tx) => {
    await tx.category.update({ where: { id: existing.id }, data: { icon: data.icon, sortOrder: data.sortOrder } });
    for (const { locale, name, description } of translations) {
      await tx.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: existing.id, locale } },
        create: { categoryId: existing.id, locale, name, description },
        update: { name, description },
      });
    }
    await tx.auditLog.create(audit(actor.admin.id, "category.update", "Category", existing.id));
  });
  taxonomyChanged();
  refresh();
  return { status: "success" };
}

/** Nur leere Kategorien können gelöscht werden; Projekte müssen vorher umziehen. */
export async function deleteCategoryAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await adminActor();
  if (!actor.ok) return actor.state;

  const id = adminIdSchema.safeParse(formData.get("categoryId"));
  if (!id.success) return adminFail("not_found");
  const category = await db.category.findUnique({
    where: { id: id.data },
    select: { id: true, slug: true, _count: { select: { projects: true, children: true } } },
  });
  if (!category) return adminFail("not_found");
  if (category._count.projects > 0 || category._count.children > 0) return adminFail("in_use");

  try {
    await db.$transaction([
      db.category.delete({ where: { id: category.id } }),
      db.auditLog.create(audit(actor.admin.id, "category.delete", "Category", category.id, { slug: category.slug })),
    ]);
  } catch (error) {
    // Zwischen Prüfung und Löschen wurde ein Projekt zugeordnet (onDelete: Restrict).
    if (error instanceof Prisma.PrismaClientKnownRequestError) return adminFail("in_use");
    throw error;
  }
  taxonomyChanged();
  refresh();
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

/** Tag-Namen stehen in der Suchspalte der Projekte; sie wird bei Änderungen neu berechnet. */
async function rebuildProjectsWithTag(tx: Prisma.TransactionClient, projectIds: readonly string[]) {
  for (const projectId of projectIds) await rebuildSearchText(tx, projectId);
}

export async function saveTagAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await adminActor();
  if (!actor.ok) return actor.state;

  const rawId = formData.get("tagId");
  const isNew = !rawId;
  const parsed = tagFormSchema.safeParse(readTagForm(formData, { withSlug: isNew }));
  if (!parsed.success) return adminFail("validation", fieldErrorsFrom(parsed.error));
  const data = parsed.data;
  const translations = routing.locales.map((locale) => ({ locale, name: data.translations[locale].name }));

  if (isNew) {
    if (!data.slug) return adminFail("validation", { slug: "slug" });
    try {
      await db.$transaction(async (tx) => {
        const row = await tx.tag.create({ data: { slug: data.slug!, translations: { create: translations } } });
        await tx.auditLog.create(audit(actor.admin.id, "tag.create", "Tag", row.id, { slug: row.slug }));
      });
    } catch (error) {
      if (isUniqueViolation(error)) return adminFail("validation", { slug: "slugTaken" });
      throw error;
    }
    taxonomyChanged();
  refresh();
    return { status: "success" };
  }

  const id = adminIdSchema.safeParse(rawId);
  if (!id.success) return adminFail("not_found");
  const tag = await db.tag.findUnique({
    where: { id: id.data },
    select: { id: true, projects: { select: { projectId: true } } },
  });
  if (!tag) return adminFail("not_found");

  await db.$transaction(async (tx) => {
    for (const { locale, name } of translations) {
      await tx.tagTranslation.upsert({
        where: { tagId_locale: { tagId: tag.id, locale } },
        create: { tagId: tag.id, locale, name },
        update: { name },
      });
    }
    await rebuildProjectsWithTag(tx, tag.projects.map((p) => p.projectId));
    await tx.auditLog.create(audit(actor.admin.id, "tag.update", "Tag", tag.id));
  });
  taxonomyChanged();
  refresh();
  return { status: "success" };
}

/** Entfernt den Tag auch aus allen Projekten (die Zuordnung wird per Cascade gelöscht). */
export async function deleteTagAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await adminActor();
  if (!actor.ok) return actor.state;

  const id = adminIdSchema.safeParse(formData.get("tagId"));
  if (!id.success) return adminFail("not_found");
  const tag = await db.tag.findUnique({
    where: { id: id.data },
    select: { id: true, slug: true, projects: { select: { projectId: true } } },
  });
  if (!tag) return adminFail("not_found");
  const projectIds = tag.projects.map((p) => p.projectId);

  await db.$transaction(async (tx) => {
    await tx.tag.delete({ where: { id: tag.id } });
    await rebuildProjectsWithTag(tx, projectIds);
    await tx.auditLog.create(
      audit(actor.admin.id, "tag.delete", "Tag", tag.id, { slug: tag.slug, removedFromProjects: projectIds.length }),
    );
  });
  taxonomyChanged();
  refresh();
  return { status: "success" };
}
