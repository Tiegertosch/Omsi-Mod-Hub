import type { ProjectStatus, ReportStatus } from "@/generated/prisma/enums";

import { isAdmin } from "./roles";

// ---------------------------------------------------------------------------
// Projekte
// ---------------------------------------------------------------------------

/** Moderationsaktionen an Projekten; nur Admins. */
export type AdminProjectAction = "approve" | "reject" | "hide" | "unhide";

/**
 * Statusübergänge der Moderation. Ausblenden betrifft nur veröffentlichte
 * Projekte; Wiedereinblenden führt zurück zu PUBLISHED.
 */
export function nextStatusForAdmin(current: ProjectStatus, action: AdminProjectAction): ProjectStatus | null {
  switch (action) {
    case "approve":
      return current === "PENDING_REVIEW" ? "PUBLISHED" : null;
    case "reject":
      return current === "PENDING_REVIEW" ? "REJECTED" : null;
    case "hide":
      return current === "PUBLISHED" ? "HIDDEN" : null;
    case "unhide":
      return current === "HIDDEN" ? "PUBLISHED" : null;
  }
}

/** Aktionen, die eine Begründung für den Creator erfordern. */
export function requiresModerationNote(action: AdminProjectAction): boolean {
  return action === "reject" || action === "hide";
}

// ---------------------------------------------------------------------------
// Meldungen
// ---------------------------------------------------------------------------

export type ReportAction = "start" | "resolve" | "dismiss" | "reopen";

export const REPORT_ACTIONS = ["start", "resolve", "dismiss", "reopen"] as const satisfies readonly ReportAction[];

export function nextReportStatus(current: ReportStatus, action: ReportAction): ReportStatus | null {
  switch (action) {
    case "start":
      return current === "OPEN" ? "IN_REVIEW" : null;
    case "resolve":
      return current === "OPEN" || current === "IN_REVIEW" ? "RESOLVED" : null;
    case "dismiss":
      return current === "OPEN" || current === "IN_REVIEW" ? "DISMISSED" : null;
    case "reopen":
      return current === "RESOLVED" || current === "DISMISSED" ? "OPEN" : null;
  }
}

export function availableReportActions(current: ReportStatus): ReportAction[] {
  return REPORT_ACTIONS.filter((action) => nextReportStatus(current, action) !== null);
}

export function isClosedReportStatus(status: ReportStatus): boolean {
  return status === "RESOLVED" || status === "DISMISSED";
}

// ---------------------------------------------------------------------------
// Konten
// ---------------------------------------------------------------------------

/** Sperrdauer in Tagen; `null` = unbefristet. */
export const BAN_DURATIONS = { "1d": 1, "7d": 7, "30d": 30, permanent: null } as const;
export type BanDuration = keyof typeof BAN_DURATIONS;

export function isBanDuration(value: unknown): value is BanDuration {
  return typeof value === "string" && Object.hasOwn(BAN_DURATIONS, value);
}

export function banExpiresAt(duration: BanDuration, now = new Date()): Date | null {
  const days = BAN_DURATIONS[duration];
  return days === null ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Ein Sperrvermerk ist wirksam, solange er nicht abgelaufen ist. */
export function isBanActive(user: { banned: boolean; banExpires: Date | null }, now = new Date()): boolean {
  return user.banned && (user.banExpires === null || user.banExpires.getTime() > now.getTime());
}

/**
 * Admins können weder sich selbst noch andere Admins sperren. Admin-Rechte
 * werden ausschließlich per CLI vergeben und entzogen (siehe README).
 */
export function canBanUser(actor: { id: string }, target: { id: string; role: string }): boolean {
  return actor.id !== target.id && !isAdmin(target.role);
}
