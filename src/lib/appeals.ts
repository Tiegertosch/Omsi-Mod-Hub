import { z } from "zod";

import type { AppealStatus, ModerationDecisionKind, ProjectStatus } from "@/generated/prisma/enums";

import type { AdminProjectAction } from "./moderation";

/**
 * Interner Beschwerdeweg: Gegen das Ausblenden und Zurückweisen eines
 * Projekts kann der Creator innerhalb der Frist einmal begründet widersprechen.
 * Sechs Monate entsprechen der Mindestfrist des Digital Services Act (Art. 20).
 */
export const APPEAL_PERIOD_MONTHS = 6;
export const APPEAL_MESSAGE_MAX = 2_000;
export const APPEAL_NOTE_MAX = 1_000;

export function appealDeadline(decidedAt: Date): Date {
  const date = new Date(decidedAt);
  date.setUTCMonth(date.getUTCMonth() + APPEAL_PERIOD_MONTHS);
  return date;
}

/** Welche Admin-Entscheidung einen Widerspruch erlaubt; `null` für alle anderen. */
export function decisionKindFor(action: AdminProjectAction): ModerationDecisionKind | null {
  if (action === "hide") return "PROJECT_HIDE";
  if (action === "reject") return "PROJECT_REJECT";
  return null;
}

/**
 * Status, aus dem ein stattgegebener Widerspruch das Projekt wieder
 * veröffentlicht. Hat sich der Status inzwischen geändert (z. B. vom Creator
 * überarbeitet oder schon wieder eingeblendet), bleibt das Projekt unverändert.
 */
export function statusReversedOnGrant(kind: ModerationDecisionKind): ProjectStatus {
  return kind === "PROJECT_HIDE" ? "HIDDEN" : "REJECTED";
}

export type AppealDecision = "grant" | "deny";
export const APPEAL_DECISIONS = ["grant", "deny"] as const satisfies readonly AppealDecision[];

export function appealStatusFor(decision: AppealDecision): AppealStatus {
  return decision === "grant" ? "GRANTED" : "DENIED";
}

/** Widerspruch nur einmal und nur innerhalb der Frist. */
export function canAppeal(decision: { appealStatus: AppealStatus; appealUntil: Date }, now: Date): boolean {
  return decision.appealStatus === "NONE" && now.getTime() < decision.appealUntil.getTime();
}

/**
 * Token aus dem Link in der E-Mail: 32 zufällige Bytes als base64url
 * (43 Zeichen). Alles andere wird verworfen, bevor die Datenbank gefragt wird.
 */
export function parseAppealToken(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export const appealMessageSchema = z
  .string()
  .trim()
  .min(1, { message: "required" })
  .max(APPEAL_MESSAGE_MAX, { message: "tooLong" });

export const appealNoteSchema = z
  .string()
  .trim()
  .min(1, { message: "required" })
  .max(APPEAL_NOTE_MAX, { message: "tooLong" });
