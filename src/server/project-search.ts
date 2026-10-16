import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { buildSearchText } from "@/lib/search-text";

/**
 * Berechnet die Suchspalte aller Übersetzungen eines Projekts neu
 * (Titel, Texte und Tag-Namen in allen Sprachen). Muss nach jeder Änderung
 * von Texten oder Tags aufgerufen werden – innerhalb derselben Transaktion.
 */
export async function rebuildSearchText(tx: Prisma.TransactionClient, projectId: string) {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: {
      translations: true,
      tags: { select: { tag: { select: { translations: { select: { name: true } } } } } },
    },
  });
  if (!project) return;
  const tagNames = project.tags.flatMap(({ tag }) => tag.translations.map((t) => t.name));
  for (const translation of project.translations) {
    await tx.projectTranslation.update({
      where: { id: translation.id },
      data: {
        searchText: buildSearchText({
          title: translation.title,
          summary: translation.summary,
          description: translation.description,
          tags: tagNames,
        }),
      },
    });
  }
}
