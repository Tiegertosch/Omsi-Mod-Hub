/**
 * Nur für E2E-Tests der Löschfristen. Altert Meldungen und Protokolleinträge
 * bzw. zählt sie – ausschließlich für Testdaten (Meldungstext beginnt mit
 * „E2E“, Konten unter @e2e.example.com). Gibt die Anzahl betroffener Einträge aus.
 *
 *   tsx tests/e2e/support/retention-fixtures.ts close-report <text> <monate>
 *   tsx tests/e2e/support/retention-fixtures.ts count-reports <text>
 *   tsx tests/e2e/support/retention-fixtures.ts age-audit <email> <monate>
 *   tsx tests/e2e/support/retention-fixtures.ts count-audit <email>
 */
import "dotenv/config";

import { createPrismaClient } from "../../../src/lib/prisma-factory";

const monthsAgo = (months: number) => {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - months);
  return date;
};

// Als reiner Text ausgeben: console.log färbt Zahlen ein, wenn FORCE_COLOR gesetzt ist (Playwright).
const print = (count: number) => process.stdout.write(`${count}\n`);

async function main() {
  const [command, target, months] = process.argv.slice(2);
  const db = createPrismaClient();
  try {
    if (command === "close-report" || command === "count-reports") {
      if (!target?.startsWith("E2E")) throw new Error("Nur Meldungen mit Text „E2E…“.");
      if (command === "count-reports") {
        print(await db.report.count({ where: { description: target } }));
        return;
      }
      const result = await db.report.updateMany({
        where: { description: target },
        data: { status: "RESOLVED", resolvedAt: monthsAgo(Number(months)) },
      });
      print(result.count);
    } else if (command === "age-audit" || command === "count-audit") {
      if (!target?.endsWith("@e2e.example.com")) throw new Error("Nur Konten unter @e2e.example.com.");
      const where = { actor: { email: target } };
      if (command === "count-audit") {
        print(await db.auditLog.count({ where }));
        return;
      }
      const result = await db.auditLog.updateMany({ where, data: { createdAt: monthsAgo(Number(months)) } });
      print(result.count);
    } else {
      throw new Error("Unbekannter Befehl.");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
