import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { CAP_ASSETS } from "../../src/lib/cap-assets";
import { captchaEndpoint, captchaRedeemSchema, isCaptchaScope, parseCaptchaToken } from "../../src/lib/captcha";

describe("Cap-Bereiche", () => {
  it("kennt nur die geschützten Formulare", () => {
    expect(isCaptchaScope("login")).toBe(true);
    expect(isCaptchaScope("report")).toBe(true);
    expect(isCaptchaScope("admin")).toBe(false);
    expect(isCaptchaScope("")).toBe(false);
  });

  it("baut den Endpunkt mit abschließendem Schrägstrich", () => {
    expect(captchaEndpoint("register")).toBe("/api/cap/register/");
  });
});

describe("parseCaptchaToken", () => {
  it("zerlegt Tokens im Format von capjs-core", () => {
    expect(parseCaptchaToken("0123456789abcdef:0123456789abcdef0123456789abcd")).toEqual({
      id: "0123456789abcdef",
      secret: "0123456789abcdef0123456789abcd",
    });
  });

  it("verwirft alles andere", () => {
    for (const value of [null, undefined, 42, "", "abc", "ABCDEF01:0123456789abcdef", "0123456789abcdef:", "x:y", `${"a".repeat(65)}:${"b".repeat(30)}`]) {
      expect(parseCaptchaToken(value)).toBeNull();
    }
  });
});

describe("captchaRedeemSchema", () => {
  it("akzeptiert Token und Lösungszahlen", () => {
    expect(captchaRedeemSchema.safeParse({ token: "t", solutions: [1, 2, 3] }).success).toBe(true);
  });

  it("lehnt manipulierte Körper ab", () => {
    for (const body of [
      null,
      {},
      { token: "", solutions: [1] },
      { token: "t", solutions: [] },
      { token: "t", solutions: [-1] },
      { token: "t", solutions: [1.5] },
      { token: "t", solutions: ["1"] },
      { token: "t", solutions: Array.from({ length: 501 }, () => 1) },
      { token: "t".repeat(4097), solutions: [1] },
    ]) {
      expect(captchaRedeemSchema.safeParse(body).success).toBe(false);
    }
  });
});

describe("Cap-Dateien in public/cap", () => {
  it.each(CAP_ASSETS)("$to entspricht $from (sonst `pnpm cap:assets`)", async ({ from, to }) => {
    const [source, copy] = await Promise.all([readFile(from), readFile(to)]);
    expect(copy.equals(source)).toBe(true);
  });
});
