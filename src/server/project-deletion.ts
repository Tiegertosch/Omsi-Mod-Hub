import "server-only";

import { db } from "@/lib/db";
import { deletionCodeMatches, projectDeletionIdentifier } from "@/lib/project-deletion";

export type ProjectDeletionResult =
  | { ok: true; slug: string; mediaUrls: (string | null)[] }
  | { ok: false; reason: "not_found" | "invalid_code" };

/** Gibt an, bis wann ein angeforderter Löschcode für das Projekt gilt (sonst null). */
export async function pendingProjectDeletion(projectId: string): Promise<Date | null> {
  const pending = await db.verification.findFirst({
    where: { identifier: projectDeletionIdentifier(projectId), expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { expiresAt: true },
  });
  return pending?.expiresAt ?? null;
}

/**
 * Löscht ein eigenes Projekt nach Prüfung des Codes in einer Transaktion. Der
 * Code wird dabei verbraucht (bedingtes Löschen, daher ist doppeltes Absenden
 * harmlos). Übersetzungen, Versionen, Links, Screenshots, Tags, Meldungen und
 * Widerspruchsdaten entfernt die Datenbank (onDelete: Cascade). Das Protokoll
 * behält Slug, Titel und letzten Status. Die Bilddateien löscht der Aufrufer
 * nach dem Commit.
 *
 * Gilt in jedem Status, auch in Prüfung oder ausgeblendet (wie die
 * Kontolöschung). Prüft keine Rechte – das übernimmt die Server Action.
 */
export async function deleteProjectWithCode(input: {
  projectId: string;
  creatorId: string;
  code: string;
}): Promise<ProjectDeletionResult> {
  const { projectId, creatorId, code } = input;
  return db.$transaction(async (tx): Promise<ProjectDeletionResult> => {
    const project = await tx.project.findFirst({
      where: { id: projectId, creatorId },
      select: {
        id: true,
        slug: true,
        status: true,
        defaultLocale: true,
        coverImageUrl: true,
        translations: { select: { locale: true, title: true } },
        screenshots: { select: { imageUrl: true } },
      },
    });
    if (!project) return { ok: false, reason: "not_found" };

    const identifier = projectDeletionIdentifier(project.id);
    const pending = await tx.verification.findFirst({
      where: { identifier, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, value: true },
    });
    if (!pending || !deletionCodeMatches(pending.value, project.id, code)) return { ok: false, reason: "invalid_code" };
    const consumed = await tx.verification.deleteMany({ where: { id: pending.id } });
    if (consumed.count !== 1) return { ok: false, reason: "invalid_code" };

    const deleted = await tx.project.deleteMany({ where: { id: project.id, creatorId } });
    if (deleted.count !== 1) return { ok: false, reason: "not_found" };
    await tx.verification.deleteMany({ where: { identifier } });

    const title =
      project.translations.find((t) => t.locale === project.defaultLocale)?.title ?? project.translations[0]?.title ?? null;
    await tx.auditLog.create({
      data: {
        actorId: creatorId,
        action: "project.delete",
        entityType: "Project",
        entityId: project.id,
        metadata: JSON.stringify({ slug: project.slug, title, status: project.status }),
      },
    });

    return {
      ok: true,
      slug: project.slug,
      mediaUrls: [project.coverImageUrl, ...project.screenshots.map((s) => s.imageUrl)],
    };
  });
}
