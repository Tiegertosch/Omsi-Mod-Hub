/**
 * Nur für E2E-Tests: setzt die gespeicherte Zustimmung zu den
 * Nutzungsbedingungen eines Testkontos (z. B. auf eine alte Fassung), damit
 * das Popup erscheint. Akzeptiert ausschließlich @e2e.example.com-Adressen.
 *
 *   pnpm exec tsx tests/e2e/support/set-terms-version.ts <email> <version|null>
 */
import "dotenv/config";

import { createPrismaClient } from "../../../src/lib/prisma-factory";

async function main() {
  const [email, version] = process.argv.slice(2);
  if (!email?.endsWith("@e2e.example.com") || !version) {
    throw new Error("Aufruf: set-terms-version.ts <adresse@e2e.example.com> <version|null>");
  }
  const db = createPrismaClient();
  try {
    await db.user.update({
      where: { email },
      data: { termsVersion: version === "null" ? null : version, termsAcceptedAt: null },
    });
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
