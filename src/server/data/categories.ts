import "server-only";

import { connection } from "next/server";
import { cache } from "react";

import { db } from "@/lib/db";
import { pickTranslation } from "@/lib/translation";

export type CategorySummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  projectCount: number;
};

/** Pro Request dedupliziert, da Kategorien in Seite und Metadaten benötigt werden. */
export const getCategories = cache(async (locale: string): Promise<CategorySummary[]> => {
  await connection();
  const [categories, counts] = await Promise.all([
    db.category.findMany({
      where: { parentId: null },
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
      include: { translations: true },
    }),
    db.project.groupBy({ by: ["categoryId"], where: { status: "PUBLISHED" }, _count: { _all: true } }),
  ]);

  const countById = new Map(counts.map((row) => [row.categoryId, row._count._all]));

  return categories.map((category) => {
    const text = pickTranslation(category.translations, locale, "en")?.translation;
    return {
      id: category.id,
      slug: category.slug,
      name: text?.name ?? category.slug,
      description: text?.description ?? null,
      icon: category.icon,
      projectCount: countById.get(category.id) ?? 0,
    };
  });
});
