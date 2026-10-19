import { describe, expect, it } from "vitest";

import { RATE_LIMIT_RETENTION_HOURS, retentionCutoffs, UNVERIFIED_ACCOUNT_RETENTION_DAYS } from "@/lib/retention";

describe("Löschfristen", () => {
  const now = new Date("2026-10-19T12:00:00.000Z");

  it("berechnet die Stichtage aus dem aktuellen Zeitpunkt", () => {
    const cutoff = retentionCutoffs(now);
    expect(cutoff.rateLimitBefore).toBe(BigInt(Date.parse("2026-10-18T12:00:00.000Z")));
    expect(cutoff.unverifiedAccountBefore.toISOString()).toBe("2026-10-12T12:00:00.000Z");
    expect(cutoff.closedReportBefore.toISOString()).toBe("2026-04-19T12:00:00.000Z");
    expect(cutoff.auditLogBefore.toISOString()).toBe("2025-10-19T12:00:00.000Z");
  });

  it("löscht Rate-Limit-Einträge erst nach dem längsten Zeitfenster (1 Stunde)", () => {
    expect(RATE_LIMIT_RETENTION_HOURS).toBeGreaterThan(1);
    expect(UNVERIFIED_ACCOUNT_RETENTION_DAYS).toBeGreaterThanOrEqual(1);
  });
});
