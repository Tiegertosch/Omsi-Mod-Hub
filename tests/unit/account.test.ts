import { describe, expect, it } from "vitest";

import { canDeleteOwnAccount, deletionConfirmed } from "@/lib/account";
import { describeUserAgent } from "@/lib/user-agent";

describe("describeUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      "Chrome",
      "Windows",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      "Edge",
      "Windows",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/120.0.0.0",
      "Opera",
      "Windows",
    ],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0", "Firefox", "Linux"],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15",
      "Safari",
      "macOS",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1",
      "Safari",
      "iOS",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1",
      "Chrome",
      "iOS",
    ],
    [
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
      "Chrome",
      "Android",
    ],
    [
      "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
      "Samsung Internet",
      "Android",
    ],
  ])("erkennt %s", (ua, browser, os) => {
    expect(describeUserAgent(ua)).toEqual({ browser, os });
  });

  it("liefert null für leere oder unbekannte Werte", () => {
    expect(describeUserAgent(null)).toEqual({ browser: null, os: null });
    expect(describeUserAgent("")).toEqual({ browser: null, os: null });
    expect(describeUserAgent("curl/8.9.1")).toEqual({ browser: null, os: null });
  });

  it("verarbeitet sehr lange Werte ohne Fehler", () => {
    expect(describeUserAgent("x".repeat(100_000))).toEqual({ browser: null, os: null });
  });
});

describe("Konto löschen", () => {
  it("ist für Mitglieder und Creator erlaubt, für Admins nicht", () => {
    expect(canDeleteOwnAccount("user")).toBe(true);
    expect(canDeleteOwnAccount("creator")).toBe(true);
    expect(canDeleteOwnAccount(null)).toBe(true);
    expect(canDeleteOwnAccount("admin")).toBe(false);
    expect(canDeleteOwnAccount("creator,admin")).toBe(false);
  });

  it("verlangt den eigenen Benutzernamen als Bestätigung", () => {
    expect(deletionConfirmed("busfahrer_42", "busfahrer_42")).toBe(true);
    expect(deletionConfirmed("  Busfahrer_42 ", "busfahrer_42")).toBe(true);
    expect(deletionConfirmed("busfahrer", "busfahrer_42")).toBe(false);
    expect(deletionConfirmed("", "busfahrer_42")).toBe(false);
    expect(deletionConfirmed("", "")).toBe(false);
  });
});
