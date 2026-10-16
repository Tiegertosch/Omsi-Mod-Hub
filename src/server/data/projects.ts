import "server-only";

import { connection } from "next/server";
import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { CATALOG_PAGE_SIZE, type CatalogParams } from "@/lib/catalog-params";
import { db } from "@/lib/db";
import { tokenizeQuery } from "@/lib/search-text";
import { pickTranslation } from "@/lib/translation";

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
  await connection();
  const where = buildCatalogWhere({ q: params.q, tags: params.tags, categoryId: options.categoryId });

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
  await connection();
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
  await connection();
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
} satisfies Prisma.ProjectInclude;

export type ProjectDetail = Prisma.ProjectGetPayload<{ include: typeof detailInclude }>;

/** Nur veröffentlichte Projekte sind öffentlich abrufbar. Pro Request dedupliziert (Seite + Metadaten). */
export const getPublishedProject = cache(async (slug: string): Promise<ProjectDetail | null> => {
  await connection();
  return db.project.findFirst({ where: { slug, status: PUBLISHED }, include: detailInclude });
});

export async function getPublishedProjectSitemapEntries() {
  await connection();
  return db.project.findMany({
    where: { status: PUBLISHED },
    select: { slug: true, updatedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 45000,
  });
}
