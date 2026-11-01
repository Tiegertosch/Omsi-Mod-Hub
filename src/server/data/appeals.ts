import "server-only";

import type { AppealStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { parseAppealToken } from "@/lib/appeals";
import { pickTranslation } from "@/lib/translation";
import { hashAppealToken } from "@/server/appeals";
import { assertAdmin } from "@/server/session";

/**
 * Entscheidung zum Widerspruchslink. Wer den Link hat, ist der betroffene
 * Creator (er kam nur per E-Mail an ihn); daher keine Anmeldung nötig.
 */
export async function getDecisionByAppealToken(rawToken: unknown, locale: string) {
  const token = parseAppealToken(rawToken);
  if (!token) return null;
  const decision = await db.moderationDecision.findUnique({
    where: { appealTokenHash: hashAppealToken(token) },
    select: {
      kind: true,
      reason: true,
      createdAt: true,
      appealUntil: true,
      appealStatus: true,
      appealMessage: true,
      appealedAt: true,
      resolutionNote: true,
      resolvedAt: true,
      project: { select: { slug: true, defaultLocale: true, translations: { select: { locale: true, title: true } } } },
    },
  });
  if (!decision) return null;
  const { project, ...rest } = decision;
  const title = pickTranslation(project.translations, locale, project.defaultLocale)?.translation.title ?? project.slug;
  return { ...rest, token, projectTitle: title };
}

// ---------------------------------------------------------------------------
// Adminbereich
// ---------------------------------------------------------------------------

export const ADMIN_APPEAL_STATUSES = ["OPEN", "GRANTED", "DENIED"] as const satisfies readonly AppealStatus[];
export type AdminAppealStatus = (typeof ADMIN_APPEAL_STATUSES)[number];

export async function getAppeals(status: AdminAppealStatus, locale: string) {
  await assertAdmin();
  const rows = await db.moderationDecision.findMany({
    where: { appealStatus: status },
    orderBy: status === "OPEN" ? { appealedAt: "asc" } : { resolvedAt: "desc" },
    take: 100,
    select: {
      id: true,
      kind: true,
      reason: true,
      createdAt: true,
      appealMessage: true,
      appealedAt: true,
      resolutionNote: true,
      resolvedAt: true,
      resolvedBy: { select: { username: true } },
      project: {
        select: {
          id: true,
          status: true,
          slug: true,
          defaultLocale: true,
          translations: { select: { locale: true, title: true } },
          creator: { select: { username: true } },
        },
      },
    },
  });
  return rows.map(({ project, ...row }) => ({
    ...row,
    project: {
      id: project.id,
      status: project.status,
      creatorUsername: project.creator.username,
      title: pickTranslation(project.translations, locale, project.defaultLocale)?.translation.title ?? project.slug,
    },
  }));
}

export async function countAppealsByStatus() {
  await assertAdmin();
  const rows = await db.moderationDecision.groupBy({
    by: ["appealStatus"],
    where: { appealStatus: { in: [...ADMIN_APPEAL_STATUSES] } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((row) => [row.appealStatus, row._count._all])) as Partial<
    Record<AdminAppealStatus, number>
  >;
}
