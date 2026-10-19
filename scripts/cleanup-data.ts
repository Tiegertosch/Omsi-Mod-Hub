/**
 * Löscht Betriebsdaten nach den Fristen in src/lib/retention.ts:
 * alte Rate-Limit-Einträge (enthalten IP-Adressen), abgelaufene Sitzungen,
 * abgelaufene Codes und Links, nie bestätigte Konten, abgeschlossene
 * Meldungen und alte Protokolleinträge.
 *
 *   pnpm data:cleanup                              alle Daten
 *   pnpm data:cleanup --only-domain=e2e.example.com  unbestätigte Konten nur dieser Domain (Tests)
 *
 * Auf dem Server täglich über deploy/omsi-mod-hub-cleanup.timer.
 */
import "dotenv/config";

import { createPrismaClient } from "../src/lib/prisma-factory";
import { retentionCutoffs } from "../src/lib/retention";

function onlyDomain(): string | null {
  const arg = process.argv.find((value) => value.startsWith("--only-domain="));
  const domain = arg?.slice("--only-domain=".length).trim().toLowerCase();
  if (arg && !domain) throw new Error("--only-domain braucht eine Domain.");
  return domain ?? null;
}

async function main() {
  const domain = onlyDomain();
  const now = new Date();
  const cutoff = retentionCutoffs(now);
  const db = createPrismaClient();
  try {
    const [rateLimits, sessions, verifications, accounts, reports, auditLogs] = await db.$transaction([
      db.rateLimit.deleteMany({ where: { lastRequest: { lt: cutoff.rateLimitBefore } } }),
      db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
      // Unbestätigte Konten können sich nicht anmelden und daher weder Projekte
      // noch ein Creator-Profil haben; die Bedingungen sichern das zusätzlich ab.
      db.user.deleteMany({
        where: {
          emailVerified: false,
          isSample: false,
          role: "user",
          createdAt: { lt: cutoff.unverifiedAccountBefore },
          projects: { none: {} },
          creatorProfile: { is: null },
          ...(domain ? { email: { endsWith: `@${domain}` } } : {}),
        },
      }),
      // Offene und in Bearbeitung befindliche Meldungen bleiben unabhängig vom Alter.
      db.report.deleteMany({
        where: {
          status: { in: ["RESOLVED", "DISMISSED"] },
          OR: [
            { resolvedAt: { lt: cutoff.closedReportBefore } },
            { resolvedAt: null, createdAt: { lt: cutoff.closedReportBefore } },
          ],
        },
      }),
      db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff.auditLogBefore } } }),
    ]);
    console.log(
      `Aufgeräumt: ${rateLimits.count} Rate-Limit-Einträge, ${sessions.count} abgelaufene Sitzungen, ` +
        `${verifications.count} abgelaufene Codes/Links, ${accounts.count} unbestätigte Konten, ` +
        `${reports.count} abgeschlossene Meldungen, ${auditLogs.count} Protokolleinträge.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
