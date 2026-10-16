import "server-only";

import { redirect } from "next/navigation";

import { hasRole, isAdmin } from "@/lib/roles";

import { requireUser, type CurrentUser } from "./session";

/** Creator-Funktionen stehen Creatorn und Admins zur Verfügung. */
export function canManageProjects(user: Pick<CurrentUser, "role">): boolean {
  return hasRole(user.role, "creator") || isAdmin(user.role);
}

/** Leitet Nutzer ohne Creator-Status zur Projektübersicht (dort: „Creator werden“). */
export async function requireCreator(locale: string, returnTo: string): Promise<CurrentUser> {
  const user = await requireUser(locale, returnTo);
  if (!canManageProjects(user)) redirect(`/${locale}/dashboard/projects`);
  return user;
}
