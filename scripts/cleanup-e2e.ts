/**
 * Entfernt Testkonten aus E2E-Läufen (@e2e.example.com) samt Projekten,
 * Meldungen, hochgeladenen Bildern, Sessions, Accounts und Verifizierungen,
 * Test-Kategorien und -Tags (Slug "e2e-…"), deren Protokolleinträge sowie die
 * Rate-Limit-Zähler. Wird vom globalen Playwright-Teardown aufgerufen.
 */
import "dotenv/config";

import { readdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { createPrismaClient } from "../src/lib/prisma-factory";
import { mediaKeyFromUrl } from "../src/lib/image-signature";

const E2E_DOMAIN = "e2e.example.com";
const E2E_SLUG_PREFIX = "e2e-";
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "storage", "uploads"));
const MAIL_DIR = path.join(process.cwd(), ".dev-mail");

/** Entfernt Entwicklungs-Mails an Testkonten; andere lokale Mails bleiben liegen. */
async function removeTestMails(): Promise<number> {
  let removed = 0;
  const files = await readdir(MAIL_DIR).catch(() => [] as string[]);
  for (const file of files.filter((f) => f.endsWith(".json"))) {
    const full = path.join(MAIL_DIR, file);
    try {
      const mail = JSON.parse(await readFile(full, "utf8")) as { to?: string };
      if (mail.to?.endsWith(`@${E2E_DOMAIN}`)) {
        await unlink(full);
        removed += 1;
      }
    } catch {
      // unlesbare Datei: liegen lassen
    }
  }
  return removed;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ist nicht gesetzt.");
  const db = createPrismaClient(url);
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
    const reports = await db.report.findMany({ where: { projectId: { in: projectIds } }, select: { id: true } });
    // Nur leere Test-Kategorien; Kategorien mit Projekten löscht die Datenbank nicht (Restrict).
    const categories = await db.category.findMany({
      where: { slug: { startsWith: E2E_SLUG_PREFIX }, projects: { none: {} } },
      select: { id: true },
    });
    const tags = await db.tag.findMany({ where: { slug: { startsWith: E2E_SLUG_PREFIX } }, select: { id: true } });
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: ids } },
          { entityType: "User", entityId: { in: ids } },
          { entityType: "Project", entityId: { in: projectIds } },
          { entityType: "Report", entityId: { in: reports.map((r) => r.id) } },
          { entityType: "Category", entityId: { in: categories.map((c) => c.id) } },
          { entityType: "Tag", entityId: { in: tags.map((t) => t.id) } },
        ],
      },
    });
    await db.project.deleteMany({ where: { id: { in: projectIds } } });
    await db.category.deleteMany({ where: { id: { in: categories.map((c) => c.id) } } });
    await db.tag.deleteMany({ where: { id: { in: tags.map((t) => t.id) } } });
    await db.verification.deleteMany({ where: { identifier: { contains: E2E_DOMAIN } } });
    const { count } = await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.rateLimit.deleteMany({});
    const mails = await removeTestMails();
    console.log(
      `E2E-Aufräumen: ${count} Testkonten, ${projects.length} Projekte, ${keys.length} Bilder, ` +
        `${categories.length} Kategorien, ${tags.length} Tags und ${mails} Test-Mails entfernt.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
