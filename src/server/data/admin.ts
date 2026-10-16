import "server-only";

import { db } from "@/lib/db";
import { assertAdmin } from "@/server/session";

/** Kennzahlen für die Admin-Übersicht. Prüft die Berechtigung selbst. */
export async function getAdminOverview() {
  await assertAdmin();

  const [users, creators, published, pending, pendingReview, openReports, latestReports, latestUsers] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: { contains: "creator" } } }),
    db.project.count({ where: { status: "PUBLISHED" } }),
    db.project.count({ where: { status: { in: ["DRAFT", "PENDING_REVIEW"] } } }),
    db.project.count({ where: { status: "PENDING_REVIEW" } }),
    db.report.count({ where: { status: "OPEN" } }),
    db.report.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        reason: true,
        description: true,
        createdAt: true,
        reporter: { select: { username: true } },
        project: { select: { slug: true, translations: { select: { locale: true, title: true } } } },
      },
    }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        emailVerified: true,
        banned: true,
        isSample: true,
        createdAt: true,
      },
    }),
  ]);

  return { stats: { users, creators, published, pending, pendingReview, openReports }, latestReports, latestUsers };
}
