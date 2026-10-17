import { db } from "@/lib/db";

import { publicCreatorWhere } from "./data/creators";

/**
 * Schnelle Existenzprüfung für öffentliche Detailrouten, ausgeführt im Proxy
 * vor dem Rendern. Nur so lässt sich ein echter HTTP-404 liefern: Sobald die
 * Seite streamt (App-Hülle mit Header), ist der Status auf 200 festgelegt.
 *
 * Die Abfragen nutzen ausschließlich eindeutige Indizes (slug, username).
 * Die Seiten prüfen weiterhin selbst und zeigen notFound(), falls sich der
 * Zustand zwischen Proxy und Rendern ändert.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const USERNAME_PATTERN = /^[a-z0-9_-]{3,32}$/;
export const LEGAL_PAGES = ["imprint", "privacy", "terms"] as const;

export type PublicDetailRoute = { kind: "mods" | "creators" | "legal"; key: string };

export async function publicRouteExists(route: PublicDetailRoute): Promise<boolean> {
  switch (route.kind) {
    case "legal":
      return (LEGAL_PAGES as readonly string[]).includes(route.key);

    case "mods": {
      if (!SLUG_PATTERN.test(route.key) || route.key.length > 80) return false;
      // /mods/[slug] bedient Kategorien und Projekte (Kategorien haben Vorrang).
      const [category, project] = await Promise.all([
        db.category.findUnique({ where: { slug: route.key }, select: { id: true } }),
        db.project.findUnique({ where: { slug: route.key }, select: { status: true } }),
      ]);
      return Boolean(category) || project?.status === "PUBLISHED";
    }

    case "creators": {
      const username = route.key.toLowerCase();
      if (!USERNAME_PATTERN.test(username)) return false;
      const user = await db.user.findFirst({
        where: { ...publicCreatorWhere, username },
        select: { id: true },
      });
      return Boolean(user);
    }
  }
}
