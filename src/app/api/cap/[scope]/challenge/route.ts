import { isCaptchaScope } from "@/lib/captcha";
import { createCaptchaChallenge } from "@/server/captcha";
import { clientKey, consumeRateLimit } from "@/server/rate-limit";

const NO_STORE = { "Cache-Control": "no-store" };

/** Neue Cap-Challenge für das Widget (siehe src/server/captcha.ts). */
export async function POST(_request: Request, context: RouteContext<"/api/cap/[scope]/challenge">) {
  const { scope } = await context.params;
  if (!isCaptchaScope(scope)) return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });

  if (!(await consumeRateLimit(await clientKey("cap-challenge"), 30, 60 * 1000))) {
    return Response.json({ error: "rate_limit" }, { status: 429, headers: NO_STORE });
  }
  return Response.json(await createCaptchaChallenge(scope), { headers: NO_STORE });
}
