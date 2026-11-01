import { describe, expect, it } from "vitest";

import {
  APPEAL_MESSAGE_MAX,
  appealDeadline,
  appealMessageSchema,
  appealStatusFor,
  canAppeal,
  decisionKindFor,
  parseAppealToken,
  statusReversedOnGrant,
} from "@/lib/appeals";

describe("Widerspruch", () => {
  it("gilt nur für Ausblenden und Zurückweisen", () => {
    expect(decisionKindFor("hide")).toBe("PROJECT_HIDE");
    expect(decisionKindFor("reject")).toBe("PROJECT_REJECT");
    expect(decisionKindFor("approve")).toBeNull();
    expect(decisionKindFor("unhide")).toBeNull();
  });

  it("hat eine Frist von sechs Monaten", () => {
    expect(appealDeadline(new Date("2026-11-01T10:00:00.000Z")).toISOString()).toBe("2027-05-01T10:00:00.000Z");
  });

  it("ist nur einmal und nur innerhalb der Frist möglich", () => {
    const until = new Date("2027-05-01T10:00:00.000Z");
    const before = new Date("2027-04-30T10:00:00.000Z");
    const after = new Date("2027-05-01T10:00:00.001Z");
    expect(canAppeal({ appealStatus: "NONE", appealUntil: until }, before)).toBe(true);
    expect(canAppeal({ appealStatus: "NONE", appealUntil: until }, after)).toBe(false);
    expect(canAppeal({ appealStatus: "OPEN", appealUntil: until }, before)).toBe(false);
    expect(canAppeal({ appealStatus: "DENIED", appealUntil: until }, before)).toBe(false);
  });

  it("nimmt beim Stattgeben nur den Status der ursprünglichen Entscheidung zurück", () => {
    expect(statusReversedOnGrant("PROJECT_HIDE")).toBe("HIDDEN");
    expect(statusReversedOnGrant("PROJECT_REJECT")).toBe("REJECTED");
    expect(appealStatusFor("grant")).toBe("GRANTED");
    expect(appealStatusFor("deny")).toBe("DENIED");
  });

  it("akzeptiert nur Tokens im erzeugten Format (32 Bytes base64url)", () => {
    const token = "a".repeat(43);
    expect(parseAppealToken(token)).toBe(token);
    expect(parseAppealToken("A-_b".repeat(10) + "xyz")).not.toBeNull();
    for (const value of [null, undefined, 42, "", "a".repeat(42), "a".repeat(44), `${"a".repeat(42)}=`, `${"a".repeat(42)}/`]) {
      expect(parseAppealToken(value)).toBeNull();
    }
  });

  it("verlangt eine Begründung mit Höchstlänge", () => {
    expect(appealMessageSchema.safeParse("  Das Projekt verstößt gegen nichts.  ").data).toBe("Das Projekt verstößt gegen nichts.");
    expect(appealMessageSchema.safeParse("   ").success).toBe(false);
    expect(appealMessageSchema.safeParse("x".repeat(APPEAL_MESSAGE_MAX + 1)).success).toBe(false);
  });
});
