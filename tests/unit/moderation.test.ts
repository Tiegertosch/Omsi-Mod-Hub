import { describe, expect, it, vi } from "vitest";

import {
  banFormSchema,
  categoryFormSchema,
  readBanForm,
  readCategoryForm,
  readTagForm,
  tagFormSchema,
} from "@/lib/admin-forms";
import { fieldErrorsFrom } from "@/lib/form-state";
import {
  availableReportActions,
  banExpiresAt,
  canBanUser,
  isBanActive,
  isBanDuration,
  nextReportStatus,
  nextStatusForAdmin,
  requiresModerationNote,
} from "@/lib/moderation";

vi.mock("server-only", () => ({}));

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("nextStatusForAdmin", () => {
  it("erlaubt Freigabe und Zurückweisung nur aus PENDING_REVIEW", () => {
    expect(nextStatusForAdmin("PENDING_REVIEW", "approve")).toBe("PUBLISHED");
    expect(nextStatusForAdmin("PENDING_REVIEW", "reject")).toBe("REJECTED");
    expect(nextStatusForAdmin("DRAFT", "approve")).toBeNull();
    expect(nextStatusForAdmin("PUBLISHED", "reject")).toBeNull();
  });

  it("blendet nur veröffentlichte Projekte aus und wieder ein", () => {
    expect(nextStatusForAdmin("PUBLISHED", "hide")).toBe("HIDDEN");
    expect(nextStatusForAdmin("HIDDEN", "unhide")).toBe("PUBLISHED");
    for (const status of ["DRAFT", "PENDING_REVIEW", "REJECTED", "ARCHIVED", "HIDDEN"] as const) {
      expect(nextStatusForAdmin(status, "hide")).toBeNull();
    }
    expect(nextStatusForAdmin("PUBLISHED", "unhide")).toBeNull();
  });

  it("verlangt eine Begründung beim Zurückweisen und Ausblenden", () => {
    expect(requiresModerationNote("reject")).toBe(true);
    expect(requiresModerationNote("hide")).toBe(true);
    expect(requiresModerationNote("approve")).toBe(false);
    expect(requiresModerationNote("unhide")).toBe(false);
  });
});

describe("Meldungen", () => {
  it("bildet den Bearbeitungsablauf ab", () => {
    expect(nextReportStatus("OPEN", "start")).toBe("IN_REVIEW");
    expect(nextReportStatus("IN_REVIEW", "resolve")).toBe("RESOLVED");
    expect(nextReportStatus("OPEN", "dismiss")).toBe("DISMISSED");
    expect(nextReportStatus("RESOLVED", "reopen")).toBe("OPEN");
    expect(nextReportStatus("IN_REVIEW", "start")).toBeNull();
    expect(nextReportStatus("DISMISSED", "resolve")).toBeNull();
  });

  it("listet nur mögliche Aktionen", () => {
    expect(availableReportActions("OPEN")).toEqual(["start", "resolve", "dismiss"]);
    expect(availableReportActions("IN_REVIEW")).toEqual(["resolve", "dismiss"]);
    expect(availableReportActions("RESOLVED")).toEqual(["reopen"]);
  });
});

describe("Kontosperren", () => {
  const now = new Date("2026-10-17T12:00:00Z");

  it("berechnet das Ablaufdatum", () => {
    expect(banExpiresAt("7d", now)?.toISOString()).toBe("2026-10-24T12:00:00.000Z");
    expect(banExpiresAt("permanent", now)).toBeNull();
    expect(isBanDuration("30d")).toBe(true);
    expect(isBanDuration("toString")).toBe(false);
    expect(isBanDuration("365d")).toBe(false);
  });

  it("erkennt abgelaufene Sperren", () => {
    expect(isBanActive({ banned: true, banExpires: null }, now)).toBe(true);
    expect(isBanActive({ banned: true, banExpires: new Date("2026-10-18T00:00:00Z") }, now)).toBe(true);
    expect(isBanActive({ banned: true, banExpires: new Date("2026-10-16T00:00:00Z") }, now)).toBe(false);
    expect(isBanActive({ banned: false, banExpires: null }, now)).toBe(false);
  });

  it("schützt das eigene Konto und andere Admins", () => {
    const admin = { id: "a1" };
    expect(canBanUser(admin, { id: "u1", role: "user" })).toBe(true);
    expect(canBanUser(admin, { id: "u2", role: "creator" })).toBe(true);
    expect(canBanUser(admin, { id: "a1", role: "admin" })).toBe(false);
    expect(canBanUser(admin, { id: "a2", role: "admin" })).toBe(false);
    expect(canBanUser(admin, { id: "a3", role: "creator,admin" })).toBe(false);
  });

  it("validiert das Sperrformular", () => {
    const ok = banFormSchema.safeParse(readBanForm(formData({ reason: " Spam ", duration: "7d", hideProjects: "on" })));
    expect(ok.success && ok.data).toEqual({ reason: "Spam", duration: "7d", hideProjects: true });

    const bad = banFormSchema.safeParse(readBanForm(formData({ reason: "", duration: "forever" })));
    expect(bad.success).toBe(false);
    if (!bad.success) expect(fieldErrorsFrom(bad.error)).toEqual({ reason: "required", duration: "duration" });
  });
});

describe("Kategorie- und Tag-Formulare", () => {
  const category = {
    slug: "Haltestellen",
    icon: "bus",
    sortOrder: "5",
    "translations.de.name": "Haltestellen",
    "translations.de.description": "",
    "translations.en.name": "Bus stops",
    "translations.en.description": "Stops and shelters",
  };

  it("normalisiert Slug und optionale Felder", () => {
    const parsed = categoryFormSchema.safeParse(readCategoryForm(formData(category), { withSlug: true }));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.slug).toBe("haltestellen");
    expect(parsed.data.sortOrder).toBe(5);
    expect(parsed.data.translations.de.description).toBeNull();
    expect(parsed.data.translations.en.description).toBe("Stops and shelters");
  });

  it("liest beim Bearbeiten keinen Slug", () => {
    const parsed = categoryFormSchema.safeParse(readCategoryForm(formData(category), { withSlug: false }));
    expect(parsed.success && parsed.data.slug).toBeUndefined();
  });

  it("lehnt unbekannte Icons, ungültige Slugs und fehlende Namen ab", () => {
    const parsed = categoryFormSchema.safeParse(
      readCategoryForm(
        formData({ ...category, slug: "Neu!", icon: "javascript:alert(1)", sortOrder: "-1", "translations.en.name": "" }),
        { withSlug: true },
      ),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(fieldErrorsFrom(parsed.error)).toEqual({
      slug: "slug",
      icon: "icon",
      sortOrder: "number",
      "translations.en.name": "required",
    });
  });

  it("verlangt Tag-Namen in allen Sprachen", () => {
    const parsed = tagFormSchema.safeParse(
      readTagForm(formData({ slug: "winter", "translations.de.name": "Winter", "translations.en.name": " " }), {
        withSlug: true,
      }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(fieldErrorsFrom(parsed.error)).toEqual({ "translations.en.name": "required" });
  });
});

describe("Benachrichtigung über Moderationsentscheidungen", () => {
  const project = { id: "p1", slug: "gelenkbus", title: "Gelenkbus GL18" };

  it("verwendet die bevorzugte Sprache und verlinkt passend zur Entscheidung", async () => {
    const { projectDecisionEmail } = await import("@/server/emails");
    const user = { email: "c@example.com", name: "Chris", preferredLocale: "de" };

    const approved = projectDecisionEmail(user, project, "approve", null);
    expect(approved.subject).toContain("Freigegeben: Gelenkbus GL18");
    expect(approved.text).toMatch(/\/de\/mods\/gelenkbus\b/);

    const hidden = projectDecisionEmail(user, project, "hide", "Link führt zu Schadsoftware.");
    expect(hidden.text).toContain("Link führt zu Schadsoftware.");
    expect(hidden.text).toMatch(/\/de\/dashboard\/projects\/p1\/edit/);

    const english = projectDecisionEmail({ ...user, preferredLocale: "fr" }, project, "reject", "Missing licence.");
    expect(english.subject).toContain("Not approved");
    expect(english.text).toMatch(/\/en\/dashboard\/projects\/p1\/edit/);
  });
});

describe("Hinweis bei Registrierung mit vergebener Adresse", () => {
  it("nennt den Benutzernamen und verlinkt Anmeldung und Passwort-Reset in der Sprache des Kontos", async () => {
    const { accountExistsEmail } = await import("@/server/emails");
    const user = { email: "c@example.com", name: "Chris", username: "chris", emailVerified: true, preferredLocale: "de" };

    const mail = accountExistsEmail(user);
    expect(mail.to).toBe("c@example.com");
    expect(mail.subject).toBe("Du hast bereits ein Konto bei OMSI Mod Hub");
    expect(mail.text).toContain("„chris“");
    expect(mail.text).toMatch(/\/de\/login\b/);
    expect(mail.text).toMatch(/\/de\/forgot-password\b/);
    expect(mail.text).not.toContain("noch nicht bestätigt");

    const unverified = accountExistsEmail({ ...user, emailVerified: false, preferredLocale: "en" });
    expect(unverified.subject).toBe("You already have an account at OMSI Mod Hub");
    expect(unverified.text).toContain("has not been confirmed yet");
    expect(unverified.text).toMatch(/\/en\/login\b/);
  });
});
