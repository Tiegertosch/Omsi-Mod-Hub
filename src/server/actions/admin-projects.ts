"use server";

import { refresh } from "next/cache";

import { db } from "@/lib/db";
import { adminActor, adminFail, adminIdSchema, type AdminState } from "@/server/admin-action";
import { projectsChanged, taxonomyChanged } from "@/server/public-cache";

/**
 * Ordnet ein Projekt einer anderen Kategorie zu (z. B. falsch eingeordnete
 * Einreichung). Die Suchspalte enthält keine Kategorie, muss also nicht neu
 * berechnet werden; Listen und Kategoriezähler werden erneuert.
 */
export async function changeProjectCategoryAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await adminActor();
  if (!actor.ok) return actor.state;

  const projectId = adminIdSchema.safeParse(formData.get("projectId"));
  const categoryId = adminIdSchema.safeParse(formData.get("categoryId"));
  if (!projectId.success) return adminFail("not_found");
  if (!categoryId.success) return adminFail("validation", { categoryId: "required" });

  const [project, category] = await Promise.all([
    db.project.findUnique({ where: { id: projectId.data }, select: { id: true, slug: true, categoryId: true } }),
    db.category.findUnique({ where: { id: categoryId.data }, select: { id: true, slug: true } }),
  ]);
  if (!project) return adminFail("not_found");
  if (!category) return adminFail("validation", { categoryId: "required" });
  if (project.categoryId === category.id) return { status: "success" };

  const updated = await db.$transaction(async (tx) => {
    // Bedingt auf die gelesene Kategorie, damit das Protokoll den tatsächlichen Wechsel zeigt.
    const result = await tx.project.updateMany({
      where: { id: project.id, categoryId: project.categoryId },
      data: { categoryId: category.id },
    });
    if (result.count === 0) return false;
    await tx.auditLog.create({
      data: {
        actorId: actor.admin.id,
        action: "project.category",
        entityType: "Project",
        entityId: project.id,
        metadata: JSON.stringify({ from: project.categoryId, to: category.id, slug: category.slug }),
      },
    });
    return true;
  });
  if (!updated) return adminFail("invalid_transition");

  projectsChanged([project.slug]);
  taxonomyChanged();
  refresh();
  return { status: "success" };
}
