import { describe, expect, it } from "vitest";

import { externalHost, isPublicHostname, isSafeImageSrc, parseExternalUrl } from "@/lib/external-url";

describe("parseExternalUrl", () => {
  it("akzeptiert öffentliche http(s)-URLs und leitet den Anbieter ab", () => {
    const result = parseExternalUrl("  https://www.Example.com/downloads/mod.zip  ");
    expect(result).toEqual({
      ok: true,
      url: "https://www.example.com/downloads/mod.zip",
      host: "www.example.com",
      provider: "example.com",
    });
    expect(parseExternalUrl("http://files.example.org/a").ok).toBe(true);
  });

  it.each([
    ["javascript:alert(1)", "protocol"],
    ["data:text/html,<script>alert(1)</script>", "protocol"],
    ["ftp://example.com/file.zip", "protocol"],
    ["file:///C:/Windows/win.ini", "protocol"],
    ["https://user:pass@example.com/", "credentials"],
    ["not a url", "invalid"],
    ["//example.com/protocol-relative", "invalid"],
  ])("lehnt %s ab (%s)", (input, error) => {
    expect(parseExternalUrl(input)).toEqual({ ok: false, error });
  });

  it.each([
    "http://localhost:3000/",
    "http://127.0.0.1/",
    "http://10.0.0.5/",
    "http://172.16.1.1/",
    "http://192.168.178.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[fd00::1]/",
    "http://intranet/",
    "http://nas.local/",
    "http://0.0.0.0/",
  ])("lehnt private bzw. lokale Ziele ab: %s", (input) => {
    expect(parseExternalUrl(input)).toEqual({ ok: false, error: "host" });
  });

  it("lehnt zu lange URLs ab", () => {
    expect(parseExternalUrl(`https://example.com/${"a".repeat(2100)}`)).toEqual({ ok: false, error: "too_long" });
  });
});

describe("isPublicHostname", () => {
  it("erkennt öffentliche Hostnamen", () => {
    expect(isPublicHostname("example.com")).toBe(true);
    expect(isPublicHostname("8.8.8.8")).toBe(true);
    expect(isPublicHostname("LOCALHOST")).toBe(false);
  });
});

describe("externalHost", () => {
  it("liefert den Anbieter oder null", () => {
    expect(externalHost("https://www.example.com/x")).toBe("example.com");
    expect(externalHost("javascript:alert(1)")).toBeNull();
  });
});

describe("isSafeImageSrc", () => {
  it("erlaubt nur lokale Pfade", () => {
    expect(isSafeImageSrc("/samples/bus-city.svg")).toBe(true);
    expect(isSafeImageSrc("//evil.example/x.png")).toBe(false);
    expect(isSafeImageSrc("https://example.com/x.png")).toBe(false);
    expect(isSafeImageSrc("/../etc/passwd")).toBe(false);
    expect(isSafeImageSrc(null)).toBe(false);
  });
});
