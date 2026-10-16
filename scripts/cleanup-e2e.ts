/**
 * Entfernt Testkonten aus E2E-Läufen (@e2e.example.com) samt Projekten,
 * hochgeladenen Bildern, Sessions, Accounts und Verifizierungen sowie die
 * Rate-Limit-Zähler. Wird vom globalen Playwright-Teardown aufgerufen.
 */
import "dotenv/config";

import { unlink } from "node:fs/promises";
import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { mediaKeyFromUrl } from "../src/lib/image-signature";

const E2E_DOMAIN = "e2e.example.com";
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "storage", "uploads"));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ist nicht gesetzt.");
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  try {
    const users = await db.user.findMany({ where: { email: { endsWith: `@${E2E_DOMAIN}` } }, select: { id: true } });
    const ids = users.map((u) => u.id);

    const projects = await db.project.findMany({
      where: { creatorId: { in: ids } },
      select: { id: true, coverImageUrl: true, screenshots: { select: { imageUrl: true } } },
    });
    const keys = projects
      .flatMap((p) => [p.coverImageUrl, ...p.screenshots.map((s) => s.imageUrl)])
      .map(mediaKeyFromUrl)
      .filter((key): key is string => key !== null);
    for (const key of keys) await unlink(path.join(UPLOAD_DIR, key)).catch(() => undefined);

    const projectIds = projects.map((p) => p.id);
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { entityType: "User", entityId: { in: ids } },
          { entityType: "Project", entityId: { in: projectIds } },
        ],
      },
    });
    await db.project.deleteMany({ where: { id: { in: projectIds } } });
    await db.verification.deleteMany({ where: { identifier: { contains: E2E_DOMAIN } } });
    const { count } = await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.rateLimit.deleteMany({});
    console.log(`E2E-Aufräumen: ${count} Testkonten, ${projects.length} Projekte, ${keys.length} Bilder entfernt.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
