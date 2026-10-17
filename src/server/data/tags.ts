import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { pickTranslation } from "@/lib/translation";
import { CACHE_TAGS } from "@/server/public-cache";

export const tagSelect = {
  slug: true,
  translations: { select: { locale: true, name: true } },
} satisfies Prisma.TagSelect;

export type TagView = { slug: string; name: string };

export function toTagView(tag: Prisma.TagGetPayload<{ select: typeof tagSelect }>, locale: string): TagView {
  return { slug: tag.slug, name: pickTranslation(tag.translations, locale, "en")?.translation.name ?? tag.slug };
}

/** Häufigste Tags veröffentlichter Projekte, optional auf eine Kategorie begrenzt. */
export async function getPopularTags(locale: string, options: { categoryId?: string; take?: number } = {}) {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.lists, CACHE_TAGS.taxonomy);
  const tags = await db.tag.findMany({
    where: {
      projects: {
        some: {
          project: { status: "PUBLISHED", ...(options.categoryId ? { categoryId: options.categoryId } : {}) },
        },
      },
    },
    orderBy: [{ projects: { _count: "desc" } }, { slug: "asc" }],
    take: options.take ?? 16,
    select: tagSelect,
  });
  return tags.map((tag) => toTagView(tag, locale));
}

export async function getTagsBySlugs(slugs: readonly string[], locale: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.lists, CACHE_TAGS.taxonomy);
  if (slugs.length === 0) return [];
  const tags = await db.tag.findMany({ where: { slug: { in: [...slugs] } }, select: tagSelect });
  return tags.map((tag) => toTagView(tag, locale));
}
