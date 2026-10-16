import { execSync } from "node:child_process";

/**
 * Entfernt die in E2E-Tests angelegten Konten. Läuft als eigenes tsx-Skript,
 * weil der generierte Prisma-Client ein ES-Modul ist.
 */
export default function globalTeardown() {
  execSync("pnpm exec tsx scripts/cleanup-e2e.ts", { stdio: "inherit" });
}
