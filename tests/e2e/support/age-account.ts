/**
 * Nur für E2E-Tests: setzt das Anlagedatum eines Testkontos in die
 * Vergangenheit, um Löschfristen zu prüfen. Akzeptiert ausschließlich
 * @e2e.example.com-Adressen.
 *
 *   pnpm exec tsx tests/e2e/support/age-account.ts <email> <tage>
 */
import "dotenv/config";

import { createPrismaClient } from "../../../src/lib/prisma-factory";

async function main() {
  const [email, days] = process.argv.slice(2);
  const age = Number(days);
  if (!email?.endsWith("@e2e.example.com") || !Number.isFinite(age)) {
    throw new Error("Aufruf: age-account.ts <adresse@e2e.example.com> <tage>");
  }
  const db = createPrismaClient();
  try {
    await db.user.update({ where: { email }, data: { createdAt: new Date(Date.now() - age * 24 * 60 * 60 * 1000) } });
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
