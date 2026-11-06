"use server";

import { refresh } from "next/cache";

import { db } from "@/lib/db";
import { FAVORITE_LIMIT } from "@/lib/favorites";
import type { FormState } from "@/lib/form-state";
import { isValidUnsubscribe } from "@/lib/unsubscribe";
import { clientKey, consumeRateLimit } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/session";

/** Fehlercodes; Texte unter Favorites.errors. */
export type FavoriteErrorCode = "unauthorized" | "rate_limit" | "not_found" | "limit" | "invalid_link" | "generic";
export type FavoriteState = FormState<FavoriteErrorCode, never>;

const MINUTE = 60 * 1000;
const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};
const fail = (code: FavoriteErrorCode): FavoriteState => ({ status: "error", code });

/**
 * Projekt merken bzw. von der Merkliste nehmen. Persönliche Daten, keine
 * Inhalte: daher getCurrentUser() ohne Prüfung der Nutzungsbedingungen. Kein
 * Cache-Tag betroffen, die Merkliste wird pro Anfrage gelesen.
 */
export async function toggleFavoriteAction(_prev: FavoriteState, formData: FormData): Promise<FavoriteState> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!(await consumeRateLimit(`favorite:user:${user.id}`, 60, 10 * MINUTE))) return fail("rate_limit");

  const projectId = str(formData, "projectId");
  if (!projectId || projectId.length > 64) return fail("not_found");

  if (str(formData, "intent") === "remove") {
    await db.favorite.deleteMany({ where: { userId: user.id, projectId } });
    refresh();
    return { status: "success" };
  }

  const project = await db.project.findFirst({ where: { id: projectId, status: "PUBLISHED" }, select: { id: true } });
  if (!project) return fail("not_found");
  if ((await db.favorite.count({ where: { userId: user.id } })) >= FAVORITE_LIMIT) return fail("limit");
  // Doppeltes Absenden (zwei Tabs) ist kein Fehler.
  await db.favorite.createMany({ data: [{ userId: user.id, projectId }], skipDuplicates: true });
  refresh();
  return { status: "success" };
}

/** Einstellung: Mails bei neuen Versionen gemerkter Projekte. */
export async function setProjectUpdateMailsAction(_prev: FavoriteState, formData: FormData): Promise<FavoriteState> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!(await consumeRateLimit(`notify-settings:user:${user.id}`, 30, 10 * MINUTE))) return fail("rate_limit");
  await db.user.update({ where: { id: user.id }, data: { notifyProjectUpdates: formData.get("notifyProjectUpdates") === "on" } });
  refresh();
  return { status: "success" };
}

/**
 * Abmelden über den Link aus der Mail (ohne Anmeldung). Nur per Knopf auf der
 * Seite, nie schon beim Aufruf: Link-Scanner von Mailanbietern rufen Links ab.
 * Ein gelöschtes Konto gilt als erfolgreich abgemeldet.
 */
export async function unsubscribeAction(_prev: FavoriteState, formData: FormData): Promise<FavoriteState> {
  const secret = process.env.BETTER_AUTH_SECRET;
  const userId = str(formData, "u");
  if (!secret || !isValidUnsubscribe(secret, userId, str(formData, "s"))) {
    // Nur ungültige Versuche zählen (Raten von Signaturen).
    if (!(await consumeRateLimit(await clientKey("unsubscribe-invalid"), 30, 10 * MINUTE))) return fail("rate_limit");
    return fail("invalid_link");
  }
  await db.user.updateMany({ where: { id: userId }, data: { notifyProjectUpdates: false } });
  return { status: "success" };
}
