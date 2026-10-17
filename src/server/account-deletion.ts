import "server-only";

import { db } from "@/lib/db";
import { mediaKeyFromUrl } from "@/lib/image-signature";
import { deleteMedia } from "@/server/storage";

export type DeletedAccount = {
  /** Slugs aller entfernten Projekte, für die Cache-Invalidierung */
  projectSlugs: string[];
  hadCreatorProfile: boolean;
};

/**
 * Löscht ein Konto vollständig in einer Transaktion: eigene Projekte (mit
 * Übersetzungen, Versionen, Links, Screenshots, Tags und Meldungen), das
 * Creator-Profil, Sitzungen, Zugangsdaten und offene Passwort-Links.
 * Eigene Meldungen zu fremden Projekten und Nennungen als Mitwirkende bleiben
 * ohne Kontobezug erhalten (onDelete: SetNull). Danach werden die Bilddateien
 * entfernt; schlägt das fehl, bleiben nur verwaiste Dateien zurück.
 *
 * Prüft keine Berechtigung – das übernimmt die aufrufende Server Action.
 */
export async function deleteUserAccount(userId: string): Promise<DeletedAccount> {
  const { projects, creatorProfile } = await db.$transaction(async (tx) => {
    const [projects, creatorProfile] = await Promise.all([
      tx.project.findMany({
        where: { creatorId: userId },
        select: { slug: true, coverImageUrl: true, screenshots: { select: { imageUrl: true } } },
      }),
      tx.creatorProfile.findUnique({ where: { userId }, select: { avatarUrl: true } }),
    ]);
    // Projekte zuerst: Die Relation zum Creator ist bewusst onDelete: Restrict.
    await tx.project.deleteMany({ where: { creatorId: userId } });
    // Better Auth legt Links zum Zurücksetzen des Passworts mit der User-ID als Wert ab.
    await tx.verification.deleteMany({ where: { value: userId } });
    await tx.user.delete({ where: { id: userId } });
    await tx.auditLog.create({
      data: {
        actorId: null,
        action: "user.self_delete",
        entityType: "User",
        entityId: userId,
        metadata: JSON.stringify({ projects: projects.length }),
      },
    });
    return { projects, creatorProfile };
  });

  const mediaUrls = [
    creatorProfile?.avatarUrl,
    ...projects.flatMap((project) => [project.coverImageUrl, ...project.screenshots.map((s) => s.imageUrl)]),
  ];
  await Promise.all(mediaUrls.map((url) => deleteMedia(mediaKeyFromUrl(url))));

  return { projectSlugs: projects.map((project) => project.slug), hadCreatorProfile: creatorProfile !== null };
}
