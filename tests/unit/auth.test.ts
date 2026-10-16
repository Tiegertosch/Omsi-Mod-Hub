import { describe, expect, it } from "vitest";

import { USERNAME_PATTERN } from "@/lib/auth-rules";
import { hasRole, isAdmin, isAppRole } from "@/lib/roles";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  const fallback = "/de/dashboard";

  it("erlaubt lokalisierte, relative Pfade inklusive Query", () => {
    expect(safeRedirectPath("/de/dashboard/settings", fallback)).toBe("/de/dashboard/settings");
    expect(safeRedirectPath("/en/mods?tag=diesel", fallback)).toBe("/en/mods?tag=diesel");
    expect(safeRedirectPath("/en", fallback)).toBe("/en");
  });

  it.each([
    "https://evil.example/de",
    "//evil.example/de",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/fr/dashboard",
    "/dashboard",
    "/de-evil/x",
    "/de/../../evil",
    "/de/%2e%2e/%2e%2e/evil",
    "/de/\nfoo",
    "",
    "x".repeat(600),
  ])("weist %s ab", (target) => {
    expect(safeRedirectPath(target, fallback)).toBe(fallback);
  });

  it("weist Nicht-Strings ab", () => {
    expect(safeRedirectPath(undefined, fallback)).toBe(fallback);
    expect(safeRedirectPath(["/de"], fallback)).toBe(fallback);
  });

  it("normalisiert Pfade innerhalb einer Sprache", () => {
    expect(safeRedirectPath("/de/mods/../creators", fallback)).toBe("/de/creators");
  });

  it("lässt kodierte Steuerzeichen kodiert (keine Header-Injection möglich)", () => {
    expect(safeRedirectPath("/de/%0d%0aSet-Cookie:x", fallback)).toBe("/de/%0d%0aSet-Cookie:x");
  });
});

describe("Rollen", () => {
  it("erkennt gültige Rollen", () => {
    expect(isAppRole("admin")).toBe(true);
    expect(isAppRole("ADMIN")).toBe(false);
    expect(isAppRole("superadmin")).toBe(false);
  });

  it("prüft Rollenlisten exakt", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("user,admin")).toBe(true);
    expect(isAdmin("user")).toBe(false);
    expect(isAdmin("notadmin")).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(hasRole("creator", "creator")).toBe(true);
  });
});

describe("Benutzernamen", () => {
  it("erlaubt nur Buchstaben, Ziffern, - und _", () => {
    expect(USERNAME_PATTERN.test("Nordlicht_Mapping-2")).toBe(true);
    expect(USERNAME_PATTERN.test("mit leerzeichen")).toBe(false);
    expect(USERNAME_PATTERN.test("ümlaut")).toBe(false);
    expect(USERNAME_PATTERN.test("../admin")).toBe(false);
  });
});
