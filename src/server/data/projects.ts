import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import type { RequirementPricing } from "@/generated/prisma/enums";
import { CATALOG_PAGE_SIZE, type CatalogParams } from "@/lib/catalog-params";
import { db } from "@/lib/db";
import { tokenizeQuery } from "@/lib/search-text";
import { pickTranslation } from "@/lib/translation";
import { CACHE_TAGS } from "@/server/public-cache";

import { tagSelect, toTagView, type TagView } from "./tags";

const PUBLISHED = "PUBLISHED" as const;

const cardInclude = {
  translations: { select: { locale: true, title: true, summary: true } },
  category: { select: { slug: true, translations: { select: { locale: true, name: true } } } },
  creator: { select: { username: true, creatorProfile: { select: { displayName: true } } } },
  versions: { orderBy: { releasedAt: "desc" }, take: 1, select: { version: true } },
  tags: { select: { tag: { select: tagSelect } } },
} satisfies Prisma.ProjectInclude;

type CardRow = Prisma.ProjectGetPayload<{ include: typeof cardInclude }>;

export type ProjectCard = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  contentLocale: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  categoryName: string;
  creatorName: string;
  latestVersion: string | null;
  publishedAt: Date | null;
  lastReleaseAt: Date | null;
  tags: TagView[];
  pricing: RequirementPricing;
  isSample: boolean;
};

function toCard(row: CardRow, locale: string): ProjectCard {
  const text = pickTranslation(row.translations, locale, row.defaultLocale);
  const categoryName = pickTranslation(row.category.translations, locale, "en")?.translation.name;
  return {
    id: row.id,
    slug: row.slug,
    title: text?.translation.title ?? row.slug,
    summary: text?.translation.summary ?? "",
    contentLocale: text?.translation.locale ?? row.defaultLocale,
    coverImageUrl: row.coverImageUrl,
    coverImageAlt: row.coverImageAlt,
    categoryName: categoryName ?? row.category.slug,
    creatorName: row.creator.creatorProfile?.displayName ?? row.creator.username,
    latestVersion: row.versions[0]?.version ?? null,
    publishedAt: row.publishedAt,
    lastReleaseAt: row.lastReleaseAt,
    tags: row.tags.map(({ tag }) => toTagView(tag, locale)),
    pricing: row.pricing,
    isSample: row.isSample,
  };
}

const ORDER_BY: Record<CatalogParams["sort"], Prisma.ProjectOrderByWithRelationInput[]> = {
  newest: [{ publishedAt: "desc" }, { id: "asc" }],
  updated: [{ lastReleaseAt: "desc" }, { publishedAt: "desc" }, { id: "asc" }],
  popular: [{ outboundClickCount: "desc" }, { publishedAt: "desc" }, { id: "asc" }],
};

export function buildCatalogWhere(options: {
  q?: string;
  tags?: readonly string[];
  price?: CatalogParams["price"];
  categoryId?: string;
  creatorId?: string;
}): Prisma.ProjectWhereInput {
  const and: Prisma.ProjectWhereInput[] = [];

  for (const slug of options.tags ?? []) {
    and.push({ tags: { some: { tag: { slug } } } });
  }

  // Jeder Suchbegriff muss in einer Übersetzung (Titel, Texte, Tags) oder im Creator-Namen vorkommen.
  for (const term of tokenizeQuery(options.q ?? "")) {
    and.push({
      OR: [
        { translations: { some: { searchText: { contains: term } } } },
        { creator: { username: { contains: term } } },
      ],
    });
  }

  return {
    status: PUBLISHED,
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(options.price === "free" ? { pricing: "FREEWARE" as const } : options.price === "paid" ? { pricing: "PAYWARE" as const } : {}),
    ...(options.creatorId ? { creatorId: options.creatorId } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };
}

export type CatalogResult = {
  items: ProjectCard[];
  total: number;
  page: number;
  pageCount: number;
};

export async function searchProjects(
  params: CatalogParams,
  locale: string,
  options: { categoryId?: string } = {},
): Promise<CatalogResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.lists);
  const where = buildCatalogWhere({ q: params.q, tags: params.tags, price: params.price, categoryId: options.categoryId });

  const total = await db.project.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const page = Math.min(params.page, pageCount);

  const rows = await db.project.findMany({
    where,
    include: cardInclude,
    orderBy: ORDER_BY[params.sort],
    skip: (page - 1) * CATALOG_PAGE_SIZE,
    take: CATALOG_PAGE_SIZE,
  });

  return { items: rows.map((row) => toCard(row, locale)), total, page, pageCount };
}

export async function getProjectList(
  kind: "newest" | "updated" | "popular",
  locale: string,
  take = 6,
): Promise<ProjectCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.lists);
  const rows = await db.project.findMany({
    where: { status: PUBLISHED, ...(kind === "popular" ? { outboundClickCount: { gt: 0 } } : {}) },
    include: cardInclude,
    orderBy: ORDER_BY[kind],
    take,
  });
  return rows.map((row) => toCard(row, locale));
}

export async function getCreatorProjects(
  creatorId: string,
  locale: string,
  options: { excludeId?: string; take?: number } = {},
): Promise<ProjectCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.lists);
  const rows = await db.project.findMany({
    where: {
      status: PUBLISHED,
      creatorId,
      ...(options.excludeId ? { id: { not: options.excludeId } } : {}),
    },
    include: cardInclude,
    orderBy: ORDER_BY.updated,
    take: options.take ?? 24,
  });
  return rows.map((row) => toCard(row, locale));
}

export const detailInclude = {
  translations: true,
  category: { select: { slug: true, translations: { select: { locale: true, name: true } } } },
  creator: {
    select: {
      id: true,
      username: true,
      creatorProfile: { select: { displayName: true, verification: true } },
    },
  },
  versions: {
    orderBy: { releasedAt: "desc" },
    include: { links: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  },
  screenshots: { orderBy: { sortOrder: "asc" } },
  tags: { select: { tag: { select: tagSelect } } },
  contributors: {
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, role: true, user: { select: { username: true } } },
  },
  requirements: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, url: true, pricing: true } },
} satisfies Prisma.ProjectInclude;

export type ProjectDetail = Prisma.ProjectGetPayload<{ include: typeof detailInclude }>;

/** Nur veröffentlichte Projekte sind öffentlich abrufbar. Zwischengespeichert, daher auch für Seite und Metadaten nur einmal abgefragt. */
export async function getPublishedProject(slug: string): Promise<ProjectDetail | null> {
  "use cache";
  cacheLife("minutes");
  // Kategorie-, Tag- und Creator-Namen stehen auf der Detailseite.
  cacheTag(CACHE_TAGS.project(slug), CACHE_TAGS.taxonomy);
  const project = await db.project.findFirst({ where: { slug, status: PUBLISHED }, include: detailInclude });
  if (project) cacheTag(CACHE_TAGS.creator(project.creator.username));
  return project;
}

// ---------------------------------------------------------------------------
// Abhängigkeiten zwischen Projekten
// ---------------------------------------------------------------------------

/** Höchstzahl der Projekte unter „Wird benötigt von“; darüber nur die Anzahl. */
export const REQUIRED_BY_LIMIT = 12;

const relatedSelect = {
  id: true,
  slug: true,
  defaultLocale: true,
  pricing: true,
  translations: { select: { locale: true, title: true } },
  creator: { select: { username: true, creatorProfile: { select: { displayName: true } } } },
} satisfies Prisma.ProjectSelect;

export type RelatedProject = {
  id: string;
  slug: string;
  title: string;
  contentLocale: string;
  creatorName: string;
  pricing: RequirementPricing;
};

function toRelated(row: Prisma.ProjectGetPayload<{ select: typeof relatedSelect }>, locale: string): RelatedProject {
  const text = pickTranslation(row.translations, locale, row.defaultLocale);
  return {
    id: row.id,
    slug: row.slug,
    title: text?.translation.title ?? row.slug,
    contentLocale: text?.translation.locale ?? row.defaultLocale,
    creatorName: row.creator.creatorProfile?.displayName ?? row.creator.username,
    pricing: row.pricing,
  };
}

export type ProjectRelations = { requires: RelatedProject[]; requiredBy: RelatedProject[]; requiredByTotal: number };

/**
 * Benötigte Projekte und „Wird benötigt von“, jeweils nur veröffentlichte.
 * Bewusst nicht Teil von getPublishedProject (Tag `project:<slug>`): Titel und
 * Status der anderen Projekte ändern sich ohne Änderung an diesem. Der Tag
 * `lists` wird nach jeder Projektänderung im Hintergrund erneuert, das hält
 * beide Richtungen aktuell, ohne die Slugs aller Beteiligten zu kennen.
 */
export async function getProjectRelations(projectId: string, locale: string): Promise<ProjectRelations> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.lists);
  const requiredByWhere = { dependsOnId: projectId, project: { status: PUBLISHED } } satisfies Prisma.ProjectDependencyWhereInput;
  const [requires, requiredBy, requiredByTotal] = await Promise.all([
    db.projectDependency.findMany({
      where: { projectId, dependsOn: { status: PUBLISHED } },
      orderBy: { sortOrder: "asc" },
      select: { dependsOn: { select: relatedSelect } },
    }),
    db.projectDependency.findMany({
      where: requiredByWhere,
      orderBy: [{ project: { lastReleaseAt: "desc" } }, { projectId: "asc" }],
      take: REQUIRED_BY_LIMIT,
      select: { project: { select: relatedSelect } },
    }),
    db.projectDependency.count({ where: requiredByWhere }),
  ]);
  return {
    requires: requires.map((row) => toRelated(row.dependsOn, locale)),
    requiredBy: requiredBy.map((row) => toRelated(row.project, locale)),
    requiredByTotal,
  };
}

// ---------------------------------------------------------------------------
// Merkliste
// ---------------------------------------------------------------------------

export type FavoriteList = {
  /** veröffentlichte Projekte, zuletzt aktualisierte zuerst */
  available: ProjectCard[];
  /** gemerkte Projekte, die zurzeit nicht öffentlich sind (nur Titel) */
  unavailable: { id: string; title: string }[];
};

/** Merkliste eines Kontos. Persönliche Daten, daher nicht zwischengespeichert. */
export async function getFavoriteProjects(userId: string, locale: string): Promise<FavoriteList> {
  const rows = await db.favorite.findMany({
    where: { userId },
    orderBy: [{ project: { lastReleaseAt: { sort: "desc", nulls: "last" } } }, { createdAt: "desc" }],
    select: { project: { include: cardInclude } },
  });
  const available: ProjectCard[] = [];
  const unavailable: FavoriteList["unavailable"] = [];
  for (const { project } of rows) {
    if (project.status === PUBLISHED) available.push(toCard(project, locale));
    else unavailable.push({ id: project.id, title: toCard(project, locale).title });
  }
  return { available, unavailable };
}

export async function getPublishedProjectSitemapEntries() {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.lists);
  return db.project.findMany({
    where: { status: PUBLISHED },
    select: { slug: true, updatedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 45000,
  });
}
