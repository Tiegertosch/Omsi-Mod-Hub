import "server-only";

import { db } from "@/lib/db";

/** Ob ein Konto Mails bei neuen Versionen gemerkter Projekte bekommt. */
export async function getProjectUpdateSetting(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { notifyProjectUpdates: true } });
  return user?.notifyProjectUpdates ?? true;
}

/** Merken-Zustand für den Knopf auf der Projektseite. Pro Anfrage, nie zwischengespeichert. */
export async function getFavoriteState(userId: string, projectId: string) {
  const [favorite, notify] = await Promise.all([
    db.favorite.findUnique({ where: { userId_projectId: { userId, projectId } }, select: { projectId: true } }),
    getProjectUpdateSetting(userId),
  ]);
  return { saved: favorite !== null, notify };
}
