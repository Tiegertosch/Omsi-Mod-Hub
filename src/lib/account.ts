import { isAdmin } from "./roles";

/**
 * Admins können ihr Konto nicht selbst löschen: Sonst könnte der Adminbereich
 * ohne Admin zurückbleiben. Die Rolle wird zuvor per CLI entzogen.
 */
export function canDeleteOwnAccount(role: string | null | undefined): boolean {
  return !isAdmin(role);
}

/** Zur Bestätigung wird der Benutzername eingetippt (ohne Rücksicht auf Groß- und Kleinschreibung). */
export function deletionConfirmed(input: string, username: string): boolean {
  return username.length > 0 && input.trim().toLowerCase() === username.toLowerCase();
}
