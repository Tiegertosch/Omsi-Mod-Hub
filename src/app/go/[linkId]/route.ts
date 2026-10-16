import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { parseExternalUrl } from "@/lib/external-url";

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless/i;

/**
 * Weiterleitung zu einem gespeicherten externen Downloadlink.
 *
 * Es wird ausschließlich auf URLs aus der Datenbank weitergeleitet (kein Open
 * Redirect). Gezählt wird der Aufruf der externen Seite – nicht der Download.
 */
export async function GET(request: NextRequest, context: RouteContext<"/go/[linkId]">) {
  const { linkId } = await context.params;

  if (!/^[a-z0-9]{1,64}$/i.test(linkId)) {
    return new NextResponse(null, { status: 404 });
  }

  const link = await db.externalLink.findFirst({
    where: { id: linkId, status: { not: "BLOCKED" }, version: { project: { status: "PUBLISHED" } } },
    select: { id: true, url: true, version: { select: { projectId: true } } },
  });

  const target = link ? parseExternalUrl(link.url) : null;
  if (!link || !target?.ok) {
    return new NextResponse(null, { status: 404 });
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  if (userAgent && !BOT_PATTERN.test(userAgent)) {
    // Rohes, parametrisiertes SQL, damit @updatedAt (Aktualisierungsdatum) unverändert bleibt.
    await db.$transaction([
      db.$executeRaw`UPDATE "ExternalLink" SET "clickCount" = "clickCount" + 1 WHERE "id" = ${link.id}`,
      db.$executeRaw`UPDATE "Project" SET "outboundClickCount" = "outboundClickCount" + 1 WHERE "id" = ${link.version.projectId}`,
    ]);
  }

  const response = NextResponse.redirect(target.url, 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
