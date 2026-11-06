import "server-only";

import { db } from "@/lib/db";
import { changelogExcerpt, UPDATE_MAIL_COOLDOWN_HOURS } from "@/lib/favorites";
import { oneClickUnsubscribePath, unsubscribePath, unsubscribeSignature } from "@/lib/unsubscribe";

import { projectUpdateEmail } from "./emails";
import { enqueueMails } from "./mail-outbox";
import { consumeRateLimit } from "./rate-limit";

const BATCH = 500;

function unsubscribeSecret(): string | null {
  return process.env.BETTER_AUTH_SECRET || null;
}

/** Abmeldelinks eines Kontos (Seite mit Bestätigung und Ein-Klick-Ziel für List-Unsubscribe). */
export function unsubscribeLinks(userId: string, locale: string) {
  const secret = unsubscribeSecret();
  if (!secret) throw new Error("BETTER_AUTH_SECRET fehlt.");
  const signature = unsubscribeSignature(secret, userId);
  return { pagePath: unsubscribePath(locale, userId, signature), oneClickPath: oneClickUnsubscribePath(userId, signature) };
}

/**
 * Nach einer neuen Version eines veröffentlichten Projekts: Mails an alle, die
 * es gemerkt haben und Benachrichtigungen erlauben (bestätigt, nicht gesperrt,
 * nicht der Creator selbst). Läuft im Hintergrund; die Mails gehen nachrangig
 * über die Warteschlange. Pro Projekt höchstens eine Runde in
 * UPDATE_MAIL_COOLDOWN_HOURS.
 */
export function queueProjectUpdateMails(projectId: string, versionId: string): void {
  queue(projectId, versionId).catch((error: unknown) => {
    console.error("[mail] Update-Mails konnten nicht angelegt werden:", error instanceof Error ? error.message : "unbekannter Fehler");
  });
}

async function queue(projectId: string, versionId: string): Promise<void> {
  if (!unsubscribeSecret()) return;
  const [project, version] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: { slug: true, status: true, creatorId: true, defaultLocale: true, translations: { select: { locale: true, title: true } } },
    }),
    db.projectVersion.findFirst({ where: { id: versionId, projectId }, select: { version: true, changelog: true } }),
  ]);
  if (!project || !version || project.status !== "PUBLISHED") return;

  const where = {
    projectId,
    userId: { not: project.creatorId },
    user: { notifyProjectUpdates: true, emailVerified: true, banned: false },
  };
  // Erst nach den Prüfungen zählen, sonst sperrt eine Version ohne Empfänger die nächste Runde.
  if ((await db.favorite.count({ where })) === 0) return;
  if (!(await consumeRateLimit(`update-mail:project:${projectId}`, 1, UPDATE_MAIL_COOLDOWN_HOURS * 60 * 60 * 1000))) return;

  const release = { version: version.version, changelog: changelogExcerpt(version.changelog) };
  let cursor: string | undefined;
  for (;;) {
    const rows = await db.favorite.findMany({
      where: { ...where, ...(cursor ? { userId: { not: project.creatorId, gt: cursor } } : {}) },
      orderBy: { userId: "asc" },
      take: BATCH,
      select: { userId: true, user: { select: { email: true, name: true, preferredLocale: true } } },
    });
    if (rows.length === 0) return;
    await enqueueMails(
      rows.map((row) =>
        projectUpdateEmail(row.user, project, release, (locale) => unsubscribeLinks(row.userId, locale)),
      ),
      { bulk: true },
    );
    if (rows.length < BATCH) return;
    cursor = rows[rows.length - 1].userId;
  }
}
