import "server-only";

import { db } from "@/lib/db";
import { describeUserAgent } from "@/lib/user-agent";
import type { CurrentUser } from "@/server/session";

/**
 * Aktive Sitzungen des angemeldeten Kontos, die aktuelle zuerst. Tokens
 * verlassen den Server nicht; die Oberfläche bekommt nur die Session-ID.
 * `updatedAt` ändert Better Auth nur beim Verlängern (höchstens einmal am Tag,
 * siehe session.updateAge) – „zuletzt aktiv“ ist daher nur auf den Tag genau.
 */
export async function getOwnSessions(user: CurrentUser) {
  const rows = await db.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, createdAt: true, updatedAt: true, ipAddress: true, userAgent: true },
  });
  return rows
    .map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      lastActiveAt: row.updatedAt,
      ipAddress: row.ipAddress,
      device: describeUserAgent(row.userAgent),
      current: row.id === user.sessionId,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

/** Zahlen für den Hinweis vor dem Löschen des Kontos. */
export async function getDeletionSummary(userId: string) {
  const [projects, published] = await Promise.all([
    db.project.count({ where: { creatorId: userId } }),
    db.project.count({ where: { creatorId: userId, status: "PUBLISHED" } }),
  ]);
  return { projects, published };
}
