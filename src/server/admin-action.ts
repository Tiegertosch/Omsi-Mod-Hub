import "server-only";

import { z } from "zod";

import type { AdminErrorCode, AdminFieldCode } from "@/lib/admin-forms";
import type { FormState } from "@/lib/form-state";
import { isAdmin } from "@/lib/roles";

import { consumeRateLimit } from "./rate-limit";
import { getActingUser, type CurrentUser } from "./session";

export type AdminState = FormState<AdminErrorCode, AdminFieldCode>;

export const adminIdSchema = z.string().min(1).max(64);

export function adminFail(code: AdminErrorCode, fieldErrors?: Record<string, AdminFieldCode>): AdminState {
  return { status: "error", code, ...(fieldErrors ? { fieldErrors } : {}) };
}

/**
 * Prüft in jeder Admin-Action erneut Anmeldung und Rolle. Das Limit schützt
 * vor versehentlichen Massenänderungen (z. B. Skripte mit gestohlener Session).
 */
export async function adminActor(): Promise<{ ok: true; admin: CurrentUser } | { ok: false; state: AdminState }> {
  const acting = await getActingUser();
  if (!acting.ok) return { ok: false, state: adminFail(acting.reason) };
  const user = acting.user;
  if (!isAdmin(user.role)) return { ok: false, state: adminFail("unauthorized") };
  if (!(await consumeRateLimit(`admin:${user.id}`, 120, 60_000))) return { ok: false, state: adminFail("rate_limit") };
  return { ok: true, admin: user };
}
