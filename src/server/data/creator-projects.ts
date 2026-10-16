import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { pickTranslation } from "@/lib/translation";
import type { CurrentUser } from "@/server/session";

import { detailInclude, type ProjectDetail } from "./projects";
import { tagSelect, toTagView } from "./tags";

/**
 * Datenzugriff für das Creator-Dashboard. Jede Funktion bekommt den bereits
 * geprüften Nutzer und filtert selbst auf dessen Projekte – ein Projekt eines
 * anderen Creators ist so nie erreichbar (auch nicht per manipulierter ID).
 */

export async function listOwnProjects(user: CurrentUser, locale: string) {
  const rows = await db.project.findMany({
    where: { creatorId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      status: true,
      defaultLocale: true,
      coverImageUrl: true,
      moderationNote: true,
      updatedAt: true,
      publishedAt: true,
      translations: { select: { locale: true, title: true } },
      versions: { orderBy: { releasedAt: "desc" }, take: 1, select: { version: true } },
    },
  });
  return rows.map((row) => ({
    ...row,
    title: pickTranslation(row.translations, locale, row.defaultLocale)?.translation.title ?? row.slug,
    latestVersion: row.versions[0]?.version ?? null,
  }));
}

export async function countOwnProjectsByStatus(user: CurrentUser) {
  const rows = await db.project.groupBy({ by: ["status"], where: { creatorId: user.id }, _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all])) as Record<string, number>;
}

const editorInclude = {
  translations: true,
  tags: { select: { tag: { select: { slug: true } } } },
  contributors: { orderBy: { sortOrder: "asc" }, select: { name: true, role: true } },
  screenshots: { orderBy: { sortOrder: "asc" } },
  versions: {
    orderBy: { releasedAt: "desc" },
    include: { links: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  },
} satisfies Prisma.ProjectInclude;

export type EditorProject = Prisma.ProjectGetPayload<{ include: typeof editorInclude }>;

export async function getOwnProjectForEditor(user: CurrentUser, projectId: string): Promise<EditorProject | null> {
  if (projectId.length > 64) return null;
  return db.project.findFirst({ where: { id: projectId, creatorId: user.id }, include: editorInclude });
}

/** Vorschau für Besitzer und Admins – auch für nicht veröffentlichte Projekte. */
export async function getProjectForPreview(user: CurrentUser, projectId: string): Promise<ProjectDetail | null> {
  if (projectId.length > 64) return null;
  return db.project.findFirst({
    where: { id: projectId, ...(isAdmin(user.role) ? {} : { creatorId: user.id }) },
    include: detailInclude,
  });
}

export async function getEditorOptions(locale: string) {
  const [categories, tags] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { slug: "asc" }], include: { translations: true } }),
    db.tag.findMany({ orderBy: { slug: "asc" }, select: tagSelect }),
  ]);
  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: pickTranslation(c.translations, locale, "en")?.translation.name ?? c.slug,
    })),
    tags: tags.map((t) => toTagView(t, locale)).sort((a, b) => a.name.localeCompare(b.name, locale)),
  };
}
