import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import { PROJECT_DELETION_CODE_LENGTH } from "./project-deletion-rules";

export { PROJECT_DELETION_CODE_LENGTH, PROJECT_DELETION_CODE_MINUTES } from "./project-deletion-rules";

/**
 * Löschen eines Projekts durch den Creator: Bestätigung mit einem 6-stelligen
 * Code per E-Mail. Der Code liegt nur als SHA-256-Hash in der Tabelle
 * `Verification` (Bezeichner pro Projekt); abgelaufene Einträge entfernt der
 * tägliche Aufräumlauf. Rateversuche begrenzt das Rate-Limit der Action.
 */

export function projectDeletionIdentifier(projectId: string): string {
  return `project-delete:${projectId}`;
}

export function generateDeletionCode(): string {
  return randomInt(0, 10 ** PROJECT_DELETION_CODE_LENGTH)
    .toString()
    .padStart(PROJECT_DELETION_CODE_LENGTH, "0");
}

/** Projekt-ID im Hash: Ein Code gilt nur für das Projekt, für das er erzeugt wurde. */
export function hashDeletionCode(projectId: string, code: string): string {
  return createHash("sha256").update(`${projectId}:${code}`).digest("hex");
}

/** Leerzeichen und Bindestriche (z. B. aus „123 456“) entfernen; sonst genau 6 Ziffern. */
export function normalizeDeletionCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${PROJECT_DELETION_CODE_LENGTH}}$`).test(code) ? code : null;
}

export function deletionCodeMatches(storedHash: string, projectId: string, code: string): boolean {
  const stored = Buffer.from(storedHash, "hex");
  const given = Buffer.from(hashDeletionCode(projectId, code), "hex");
  return stored.length === given.length && timingSafeEqual(stored, given);
}
