/** Rollen werden ausschließlich serverseitig vergeben (Admin-Aktion oder CLI). */
export const ROLES = ["user", "creator", "admin"] as const;
export type AppRole = (typeof ROLES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Better Auth erlaubt mehrere Rollen als kommagetrennte Liste. */
export function hasRole(roleField: string | null | undefined, role: AppRole): boolean {
  return (roleField ?? "")
    .split(",")
    .map((r) => r.trim())
    .includes(role);
}

export const isAdmin = (roleField: string | null | undefined) => hasRole(roleField, "admin");

/**
 * Admin-Rechte gelten nur mit aktiver Zwei-Faktor-Anmeldung. Admins ohne 2FA
 * werden zur Einrichtung geleitet (requireAdmin); Actions und Datenfunktionen
 * behandeln sie wie Nicht-Admins.
 */
export function hasAdminAccess(user: { role: string | null | undefined; twoFactorEnabled: boolean }): boolean {
  return isAdmin(user.role) && user.twoFactorEnabled;
}
