import { describe, expect, it } from "vitest";

import { AUDIT_PAGE_SIZE, auditQuery, parseAuditFilter } from "@/lib/audit-filter";
import { availableLinkActions, linkActionNeedsNote, nextLinkStatus } from "@/lib/moderation";

describe("Linkstatus", () => {
  it("markiert nur ungeprüfte oder geprüfte Links als defekt", () => {
    expect(nextLinkStatus("UNCHECKED", "markBroken")).toBe("BROKEN");
    expect(nextLinkStatus("OK", "markBroken")).toBe("BROKEN");
    expect(nextLinkStatus("BROKEN", "markBroken")).toBeNull();
    expect(nextLinkStatus("BLOCKED", "markBroken")).toBeNull();
  });

  it("sperrt aus jedem Status außer gesperrt, freigeben nur aus defekt oder gesperrt", () => {
    expect(nextLinkStatus("BROKEN", "block")).toBe("BLOCKED");
    expect(nextLinkStatus("BLOCKED", "block")).toBeNull();
    expect(nextLinkStatus("BLOCKED", "release")).toBe("OK");
    expect(nextLinkStatus("BROKEN", "release")).toBe("OK");
    expect(nextLinkStatus("OK", "release")).toBeNull();
  });

  it("bietet passende Aktionen an und verlangt beim Sperren eine Begründung", () => {
    expect(availableLinkActions("UNCHECKED")).toEqual(["markBroken", "block"]);
    expect(availableLinkActions("BLOCKED")).toEqual(["release"]);
    expect(linkActionNeedsNote("block")).toBe(true);
    expect(linkActionNeedsNote("markBroken")).toBe(false);
  });
});

describe("Protokollfilter", () => {
  it("übernimmt gültige Parameter", () => {
    expect(parseAuditFilter({ area: "user", q: " Ban ", page: "3" })).toEqual({ area: "user", q: "ban", page: 3 });
    expect(AUDIT_PAGE_SIZE).toBeGreaterThan(0);
  });

  it("verwirft unbekannte Bereiche, unzulässige Suchbegriffe und Seiten", () => {
    expect(parseAuditFilter({ area: "Project", q: "ban'; --", page: "-2" })).toEqual({ area: null, q: "", page: 1 });
    expect(parseAuditFilter({ area: ["link", "user"], page: "999999" })).toEqual({ area: "link", q: "", page: 1000 });
    expect(parseAuditFilter({})).toEqual({ area: null, q: "", page: 1 });
  });

  it("lässt leere Filter in Seitenlinks weg", () => {
    expect(auditQuery({ area: null, q: "", page: 2 })).toEqual({});
    expect(auditQuery({ area: "report", q: "resolve", page: 1 })).toEqual({ area: "report", q: "resolve" });
  });
});
