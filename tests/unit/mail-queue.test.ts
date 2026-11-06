import { describe, expect, it } from "vitest";

import {
  allowedMailPriority,
  decideRetry,
  DEFAULT_MAIL_VALID_HOURS,
  MAX_MAIL_ATTEMPTS,
  mailErrorCode,
  mailExpiresAt,
  mailRetryDelayMs,
} from "@/lib/mail-queue";

const MINUTE = 60 * 1000;
const now = new Date("2026-11-06T12:00:00Z");

describe("Mail-Warteschlange: Wiederholung", () => {
  it("wartet 1, 2, 5, 10, 30, 60 Minuten, danach 3 Stunden", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 11].map((n) => mailRetryDelayMs(n) / MINUTE)).toEqual([1, 2, 5, 10, 30, 60, 180, 180]);
  });

  it("versucht es erneut, solange der nächste Versuch vor dem Ablauf liegt", () => {
    const decision = decideRetry(1, now, new Date(now.getTime() + 15 * MINUTE));
    expect(decision).toEqual({ kind: "retry", nextAttemptAt: new Date(now.getTime() + MINUTE) });
  });

  it("gibt auf, wenn der nächste Versuch nach dem Ablauf läge (z. B. Code)", () => {
    expect(decideRetry(4, now, new Date(now.getTime() + 5 * MINUTE))).toEqual({ kind: "fail" });
  });

  it("gibt nach der Höchstzahl an Versuchen auf", () => {
    expect(decideRetry(MAX_MAIL_ATTEMPTS, now, new Date(now.getTime() + 1000 * 60 * MINUTE))).toEqual({ kind: "fail" });
  });
});

describe("Mail-Warteschlange: Ablauf", () => {
  it("nimmt die Gültigkeit von Codes und Links", () => {
    expect(mailExpiresAt(now, 15)).toEqual(new Date(now.getTime() + 15 * MINUTE));
  });

  it("nimmt sonst die Standardfrist", () => {
    expect(mailExpiresAt(now)).toEqual(new Date(now.getTime() + DEFAULT_MAIL_VALID_HOURS * 60 * MINUTE));
    expect(mailExpiresAt(now, 0)).toEqual(mailExpiresAt(now));
  });
});

describe("Mail-Warteschlange: Fehlercode", () => {
  it("speichert nur den Code von nodemailer und den SMTP-Status", () => {
    const error = Object.assign(new Error("550 5.1.1 <name@example.com> unknown"), { code: "EENVELOPE", responseCode: 550 });
    expect(mailErrorCode(error)).toBe("EENVELOPE:550");
  });

  it("enthält nie die Fehlermeldung", () => {
    expect(mailErrorCode(new Error("Verbindung zu name@example.com"))).toBe("error");
    expect(mailErrorCode({ code: "name@example.com" })).toBe("error");
    expect(mailErrorCode("text")).toBe("unknown");
  });
});

describe("Mail-Warteschlange: Stundenlimit des Mailanbieters", () => {
  it("ohne Limit gehen alle Mails raus", () => {
    expect(allowedMailPriority(10_000, null)).toBe(1);
  });

  it("Benachrichtigungen nutzen höchstens 80 %, der Rest bleibt für Codes und Kontomails", () => {
    expect(allowedMailPriority(0, 100)).toBe(1);
    expect(allowedMailPriority(79, 100)).toBe(1);
    expect(allowedMailPriority(80, 100)).toBe(0);
    expect(allowedMailPriority(99, 100)).toBe(0);
  });

  it("ist das Limit erreicht, wartet alles", () => {
    expect(allowedMailPriority(100, 100)).toBeNull();
    expect(allowedMailPriority(150, 100)).toBeNull();
  });
});
