import "server-only";

import type { ProjectStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { pickTranslation } from "@/lib/translation";
import { assertAdmin } from "@/server/session";

/** Projekte für die Moderationsübersicht. Prüft die Admin-Berechtigung selbst. */
export async function getReviewQueue(status: ProjectStatus, locale: string) {
  await assertAdmin();
  const rows = await db.project.findMany({
    where: { status },
    orderBy: status === "PENDING_REVIEW" ? { submittedAt: "asc" } : { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      slug: true,
      status: true,
      defaultLocale: true,
      submittedAt: true,
      updatedAt: true,
      isSample: true,
      moderationNote: true,
      creator: { select: { username: true } },
      translations: { select: { locale: true, title: true, summary: true } },
      category: { select: { translations: { select: { locale: true, name: true } } } },
      _count: { select: { reports: { where: { status: { in: ["OPEN", "IN_REVIEW"] } } } } },
    },
  });
  return rows.map(({ _count, ...row }) => {
    const text = pickTranslation(row.translations, locale, row.defaultLocale)?.translation;
    return {
      ...row,
      title: text?.title ?? row.slug,
      summary: text?.summary ?? "",
      categoryName: pickTranslation(row.category.translations, locale, "en")?.translation.name ?? "",
      openReports: _count.reports,
    };
  });
}

export async function countProjectsByStatus() {
  await assertAdmin();
  const rows = await db.project.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all])) as Partial<Record<ProjectStatus, number>>;
}
