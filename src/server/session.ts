import "server-only";

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { needsTermsConsent } from "@/lib/legal";
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
  /** ID (nicht Token) der aktuellen Session, z. B. für die Geräteübersicht */
  sessionId: string;
  /** Fassung der Nutzungsbedingungen, der zugestimmt wurde (null = noch keiner) */
  termsVersion: string | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Cookies aus cookies() statt aus den Original-Headern lesen: Nach einer
  // Server Action (z. B. Passwortwechsel mit neuer Session) enthalten sie
  // bereits das neu gesetzte Session-Cookie.
  const [incoming, cookieStore] = await Promise.all([headers(), cookies()]);
  const requestHeaders = new Headers(incoming);
  requestHeaders.set("cookie", cookieStore.toString());
  // Better Auth prüft den Ablauf der Session gegen die aktuelle Uhrzeit (new Date()).
  // Ohne connection() würde der Runtime-Prefetch (partialPrefetching) diesen Aufruf
  // vorab rendern wollen und mit „blocking-prerender-current-time“ abbrechen.
  await connection();
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
    sessionId: session.session.id,
    termsVersion: user.termsVersion ?? null,
  };
});

export type ActingUser =
  | { ok: true; user: CurrentUser }
  | { ok: false; reason: "unauthorized" | "terms_required" };

/**
 * Serverseitige Sperre für Server Actions, die Inhalte oder Profile ändern:
 * nur mit Zustimmung zur neuesten Fassung der Nutzungsbedingungen (das Popup
 * allein ließe sich umgehen). Bewusst NICHT verwendet von Anmelden/Abmelden,
 * Kontosicherheit (Passwort, E-Mail, Sitzungen), den Popup-Aktionen und dem
 * Löschen des eigenen Kontos – die nutzen getCurrentUser().
 */
export async function getActingUser(): Promise<ActingUser> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthorized" };
  if (needsTermsConsent(user.termsVersion)) return { ok: false, reason: "terms_required" };
  return { ok: true, user };
}

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
