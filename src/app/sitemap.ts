import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";
import { getCategories } from "@/server/data/categories";
import { getCreatorSitemapEntries } from "@/server/data/creators";
import { getPublishedProjectSitemapEntries } from "@/server/data/projects";

function entry(path: string, lastModified?: Date): MetadataRoute.Sitemap {
  const suffix = path === "/" ? "" : path;
  const languages = Object.fromEntries(routing.locales.map((l) => [l, `${siteConfig.url}/${l}${suffix}`]));
  return routing.locales.map((locale) => ({
    url: `${siteConfig.url}/${locale}${suffix}`,
    lastModified,
    alternates: { languages },
  }));
}

/** Öffentliche Seiten, Kategorien, veröffentlichte Projekte und Creator-Profile. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, projects, creators] = await Promise.all([
    getCategories(routing.defaultLocale),
    getPublishedProjectSitemapEntries(),
    getCreatorSitemapEntries(),
  ]);

  return [
    ...entry("/"),
    ...entry("/mods"),
    ...entry("/creators"),
    ...categories.flatMap((category) => entry(`/mods/${category.slug}`)),
    ...projects.flatMap((project) => entry(`/mods/${project.slug}`, project.updatedAt)),
    ...creators.flatMap((creator) => entry(`/creators/${creator.username}`, creator.updatedAt)),
  ];
}
