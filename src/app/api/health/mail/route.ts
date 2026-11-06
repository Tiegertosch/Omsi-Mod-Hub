import { connection } from "next/server";

import { db } from "@/lib/db";
import { MAIL_ALERT_ATTEMPTS } from "@/lib/mail-queue";
import { mailChannel } from "@/server/mail-transport";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Zustand der Mail-Warteschlange für ein eigenes Uptime-Monitoring (Better
 * Stack). Getrennt von /api/health, weil deploy.sh dort prüft: Ein Ausfall des
 * Mailservers während eines Deployments darf keinen Rollback auslösen.
 *
 * 503, wenn eine Mail mehrfach nicht zugestellt werden konnte oder in den
 * letzten 24 Stunden endgültig gescheitert ist. Keine Details in der Antwort.
 */
export async function GET() {
  await connection();
  const headers = { "Cache-Control": "no-store" };
  try {
    const problem = await db.mailOutbox.findFirst({
      where: {
        // Nur der eigene Versandweg (lokal teilen sich Entwicklung und E2E-Tests die Datenbank).
        channel: mailChannel(),
        OR: [
          { failedAt: null, attempts: { gte: MAIL_ALERT_ATTEMPTS } },
          { failedAt: { gte: new Date(Date.now() - DAY) }, lastError: { not: "expired" } },
          // Abgelaufen, ohne dass ein Versand versucht wurde: der Versandlauf hängt.
          { failedAt: { gte: new Date(Date.now() - DAY) }, lastError: "expired", attempts: 0 },
        ],
      },
      select: { id: true },
    });
    if (problem) return Response.json({ status: "error" }, { status: 503, headers });
    return Response.json({ status: "ok" }, { headers });
  } catch (error) {
    console.error("[health] Mail-Warteschlange nicht prüfbar:", error instanceof Error ? error.message : "unbekannter Fehler");
    return Response.json({ status: "error" }, { status: 503, headers });
  }
}
