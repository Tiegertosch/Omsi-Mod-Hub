import { db } from "@/lib/db";
import { isValidUnsubscribe } from "@/lib/unsubscribe";
import { clientKey, consumeRateLimit } from "@/server/rate-limit";

/**
 * Abmelden mit einem Klick aus dem Mailprogramm (List-Unsubscribe-Post,
 * RFC 8058). Das Mailprogramm schickt ein POST mit
 * `List-Unsubscribe=One-Click`; ein GET ändert nichts (Link-Scanner).
 * Berechtigt ist, wer die signierte Adresse aus der Mail kennt.
 */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!(await consumeRateLimit(await clientKey("unsubscribe"), 30, 10 * 60 * 1000))) {
    return new Response(null, { status: 429, headers });
  }
  const url = new URL(request.url);
  const userId = url.searchParams.get("u");
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || !isValidUnsubscribe(secret, userId, url.searchParams.get("s"))) {
    return new Response(null, { status: 400, headers });
  }
  await db.user.updateMany({ where: { id: userId }, data: { notifyProjectUpdates: false } });
  return new Response(null, { status: 200, headers });
}
