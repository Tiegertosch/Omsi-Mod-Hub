import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ReportStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { isClosedReportStatus } from "@/lib/moderation";
import { tokenizeQuery } from "@/lib/search-text";
import { pickTranslation } from "@/lib/translation";
import { assertAdmin } from "@/server/session";

/** Kennzahlen für die Admin-Übersicht. Prüft die Berechtigung selbst. */
export async function getAdminOverview() {
  await assertAdmin();

  const [users, creators, published, pendingReview, openReports, latestReports, latestUsers] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: { contains: "creator" } } }),
    db.project.count({ where: { status: "PUBLISHED" } }),
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

  return { stats: { users, creators, published, pendingReview, openReports }, latestReports, latestUsers };
}

// ---------------------------------------------------------------------------
// Meldungen
// ---------------------------------------------------------------------------

export async function getReports(status: ReportStatus, locale: string) {
  await assertAdmin();
  const rows = await db.report.findMany({
    where: { status },
    orderBy: { createdAt: isClosedReportStatus(status) ? "desc" : "asc" },
    take: 100,
    select: {
      id: true,
      reason: true,
      description: true,
      status: true,
      resolutionNote: true,
      createdAt: true,
      resolvedAt: true,
      reporter: { select: { username: true } },
      resolvedBy: { select: { username: true } },
      project: {
        select: {
          id: true,
          slug: true,
          status: true,
          defaultLocale: true,
          translations: { select: { locale: true, title: true } },
          creator: { select: { username: true } },
          _count: { select: { reports: { where: { status: { in: ["OPEN", "IN_REVIEW"] } } } } },
        },
      },
    },
  });
  return rows.map(({ project, ...row }) => ({
    ...row,
    project: {
      id: project.id,
      slug: project.slug,
      status: project.status,
      creatorUsername: project.creator.username,
      openReports: project._count.reports,
      title: pickTranslation(project.translations, locale, project.defaultLocale)?.translation.title ?? project.slug,
    },
  }));
}

export async function countReportsByStatus() {
  await assertAdmin();
  const rows = await db.report.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all])) as Partial<Record<ReportStatus, number>>;
}

// ---------------------------------------------------------------------------
// Konten
// ---------------------------------------------------------------------------

export const USER_FILTERS = ["all", "banned", "creator", "admin"] as const;
export type UserFilter = (typeof USER_FILTERS)[number];
const USERS_PER_PAGE = 25;

export async function getUsers(options: { q: string; filter: UserFilter; page: number }) {
  await assertAdmin();
  const terms = tokenizeQuery(options.q);
  const where: Prisma.UserWhereInput = {
    ...(options.filter === "banned" ? { banned: true } : {}),
    ...(options.filter === "creator" || options.filter === "admin" ? { role: { contains: options.filter } } : {}),
    AND: terms.map((term) => ({
      // Benutzernamen und E-Mails sind kleingeschrieben gespeichert, Namen nicht.
      OR: [{ username: { contains: term } }, { email: { contains: term } }, { name: { contains: term, mode: "insensitive" } }],
    })),
  };
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * USERS_PER_PAGE,
      take: USERS_PER_PAGE,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        banned: true,
        banReason: true,
        banExpires: true,
        isSample: true,
        createdAt: true,
        creatorProfile: { select: { displayName: true } },
        _count: { select: { projects: { where: { status: "PUBLISHED" } } } },
      },
    }),
  ]);
  return { users, total, pageCount: Math.max(1, Math.ceil(total / USERS_PER_PAGE)) };
}

// ---------------------------------------------------------------------------
// Kategorien, Tags und Protokoll
// ---------------------------------------------------------------------------

export async function getAdminCategories() {
  await assertAdmin();
  return db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    select: {
      id: true,
      slug: true,
      icon: true,
      sortOrder: true,
      parentId: true,
      translations: { select: { locale: true, name: true, description: true } },
      _count: { select: { projects: true, children: true } },
    },
  });
}

export async function getAdminTags() {
  await assertAdmin();
  return db.tag.findMany({
    orderBy: { slug: "asc" },
    select: {
      id: true,
      slug: true,
      translations: { select: { locale: true, name: true } },
      _count: { select: { projects: true } },
    },
  });
}

export async function getAuditLog() {
  await assertAdmin();
  return db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      actor: { select: { username: true } },
    },
  });
}

/** Zähler für die Admin-Navigation. */
export async function getAdminBadgeCounts() {
  await assertAdmin();
  const [pendingReview, openReports] = await Promise.all([
    db.project.count({ where: { status: "PENDING_REVIEW" } }),
    db.report.count({ where: { status: "OPEN" } }),
  ]);
  return { pendingReview, openReports };
}
