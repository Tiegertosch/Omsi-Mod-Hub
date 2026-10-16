import "server-only";

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { hasRole, isAdmin, type AppRole } from "@/lib/roles";

/**
 * Data Access Layer für die Anmeldung. Liest die Session pro Request (nie
 * gecacht) und gibt nur die Felder heraus, die die Oberfläche benötigt.
 * Komponenten, die das aufrufen, müssen hinter <Suspense> stehen.
 */
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  username: string;
  role: string;
  preferredLocale: string | null;
  createdAt: Date;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Cookies aus cookies() statt aus den Original-Headern lesen: Nach einer
  // Server Action (z. B. Passwortwechsel mit neuer Session) enthalten sie
  // bereits das neu gesetzte Session-Cookie.
  const requestHeaders = new Headers(await headers());
  requestHeaders.set("cookie", (await cookies()).toString());
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { user } = session;
  // Gesperrte Konten gelten als abgemeldet, auch wenn noch eine Session existiert.
  if (user.banned) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    username: user.username ?? "",
    role: user.role ?? "user",
    preferredLocale: user.preferredLocale ?? null,
    createdAt: user.createdAt,
  };
});

/** Leitet nicht angemeldete Nutzer zum Login um (mit Rücksprungziel). */
export async function requireUser(locale: string, returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Nicht-Admins erhalten eine 404, damit der Adminbereich nicht auffällt. */
export async function requireAdmin(locale: string, returnTo: string): Promise<CurrentUser> {
  const user = await requireUser(locale, returnTo);
  if (!isAdmin(user.role)) notFound();
  return user;
}

/** Für Datenfunktionen: wirft 404, wenn kein Admin angemeldet ist (ohne Weiterleitung). */
export async function assertAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) notFound();
  return user;
}

export function userHasRole(user: CurrentUser, role: AppRole) {
  return hasRole(user.role, role);
}
