import { describe, expect, it } from "vitest";

import { isValidUnsubscribe, oneClickUnsubscribePath, unsubscribePath, unsubscribeSignature } from "@/lib/unsubscribe";

const secret = "test-secret-mit-ausreichender-laenge-0123456789";

describe("Abmeldelinks", () => {
  it("akzeptiert die eigene Signatur", () => {
    const signature = unsubscribeSignature(secret, "user1");
    expect(isValidUnsubscribe(secret, "user1", signature)).toBe(true);
  });

  it("lehnt fremde Konten, anderes Secret und Unsinn ab", () => {
    const signature = unsubscribeSignature(secret, "user1");
    expect(isValidUnsubscribe(secret, "user2", signature)).toBe(false);
    expect(isValidUnsubscribe("anderes-secret", "user1", signature)).toBe(false);
    expect(isValidUnsubscribe(secret, "user1", signature.slice(0, -1))).toBe(false);
    expect(isValidUnsubscribe(secret, "user1", "")).toBe(false);
    expect(isValidUnsubscribe(secret, "", signature)).toBe(false);
    expect(isValidUnsubscribe(secret, undefined, signature)).toBe(false);
    expect(isValidUnsubscribe(secret, "user1", ["x"])).toBe(false);
  });

  it("baut Seite und Ein-Klick-Ziel mit kodierten Parametern", () => {
    expect(unsubscribePath("de", "user1", "a-b_c")).toBe("/de/unsubscribe?u=user1&s=a-b_c");
    expect(oneClickUnsubscribePath("user1", "a-b_c")).toBe("/api/unsubscribe?u=user1&s=a-b_c");
  });
});
