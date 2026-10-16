import "server-only";

import type { ProjectStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { pickTranslation } from "@/lib/translation";
import { assertAdmin } from "@/server/session";

/** Projekte für die Freigabe-Übersicht. Prüft die Admin-Berechtigung selbst. */
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
    },
  });
  return rows.map((row) => {
    const text = pickTranslation(row.translations, locale, row.defaultLocale)?.translation;
    return {
      ...row,
      title: text?.title ?? row.slug,
      summary: text?.summary ?? "",
      categoryName: pickTranslation(row.category.translations, locale, "en")?.translation.name ?? "",
    };
  });
}

export async function countPendingReviews() {
  await assertAdmin();
  return db.project.count({ where: { status: "PENDING_REVIEW" } });
}
