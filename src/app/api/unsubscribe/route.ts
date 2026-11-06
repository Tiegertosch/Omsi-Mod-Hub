import { db } from "@/lib/db";
import { isValidUnsubscribe } from "@/lib/unsubscribe";
import { clientKey, consumeRateLimit } from "@/server/rate-limit";

/**
 * Abmelden mit einem Klick aus dem Mailprogramm (List-Unsubscribe-Post,
 * RFC 8058). Das Mailprogramm schickt ein POST mit
 * `List-Unsubscribe=One-Click`; ein GET ändert nichts (Link-Scanner).
 * Berechtigt ist, wer die signierte Adresse aus der Mail kennt; das
 * Rate-Limit pro IP gilt nur für ungültige Signaturen.
 */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const url = new URL(request.url);
  const userId = url.searchParams.get("u");
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || !isValidUnsubscribe(secret, userId, url.searchParams.get("s"))) {
    // Nur ungültige Versuche zählen: Große Mailanbieter senden gültige
    // Abmeldungen gebündelt von wenigen IP-Adressen.
    const allowed = await consumeRateLimit(await clientKey("unsubscribe-invalid"), 30, 10 * 60 * 1000);
    return new Response(null, { status: allowed ? 400 : 429, headers });
  }
  await db.user.updateMany({ where: { id: userId }, data: { notifyProjectUpdates: false } });
  return new Response(null, { status: 200, headers });
}
