import { captchaRedeemSchema, isCaptchaScope } from "@/lib/captcha";
import { redeemCaptchaChallenge } from "@/server/captcha";
import { clientKey, consumeRateLimit } from "@/server/rate-limit";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY_CHARS = 16 * 1024;

/** Löst eine gelöste Cap-Challenge gegen ein Einmal-Token ein (siehe src/server/captcha.ts). */
export async function POST(request: Request, context: RouteContext<"/api/cap/[scope]/redeem">) {
  const { scope } = await context.params;
  if (!isCaptchaScope(scope)) return Response.json({ success: false, error: "not_found" }, { status: 404, headers: NO_STORE });

  if (!(await consumeRateLimit(await clientKey("cap-redeem"), 30, 60 * 1000))) {
    return Response.json({ success: false, error: "rate_limit" }, { status: 429, headers: NO_STORE });
  }

  // Eine gültige Antwort ist wenige KB groß; größere Körper gar nicht erst lesen.
  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_BODY_CHARS) {
    return Response.json({ success: false, error: "invalid_body" }, { status: 413, headers: NO_STORE });
  }
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    // bleibt null → invalid_body
  }
  const body = captchaRedeemSchema.safeParse(json);
  if (!body.success) return Response.json({ success: false, error: "invalid_body" }, { status: 400, headers: NO_STORE });

  const redeemed = await redeemCaptchaChallenge(scope, body.data);
  if (!redeemed) return Response.json({ success: false, error: "invalid_solution" }, { status: 400, headers: NO_STORE });
  return Response.json({ success: true, ...redeemed }, { headers: NO_STORE });
}
