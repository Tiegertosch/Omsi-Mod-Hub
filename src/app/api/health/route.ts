import { connection } from "next/server";

import { db } from "@/lib/db";

/**
 * Health-Check für Reverse Proxy und Uptime-Monitoring. Prüft nur, ob die
 * Datenbank antwortet, und gibt keine internen Details preis.
 */
export async function GET() {
  // Immer zur Anfragezeit ausführen, nie beim Build vorrendern.
  await connection();
  const headers = { "Cache-Control": "no-store" };
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers });
  } catch (error) {
    console.error("[health] Datenbank nicht erreichbar:", error instanceof Error ? error.message : "unbekannter Fehler");
    return Response.json({ status: "error" }, { status: 503, headers });
  }
}
