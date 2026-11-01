"use server";

import { refresh } from "next/cache";

import { moderationNoteSchema, optionalModerationNoteSchema } from "@/lib/admin-forms";
import { db } from "@/lib/db";
import { LINK_ACTIONS, linkActionNeedsNote, nextLinkStatus, type LinkAction } from "@/lib/moderation";
import { pickTranslation } from "@/lib/translation";
import { adminActor, adminFail, adminIdSchema, type AdminState } from "@/server/admin-action";
import { linkStatusEmail } from "@/server/emails";
import { sendMailInBackground } from "@/server/mail";
import { projectsChanged } from "@/server/public-cache";

/**
 * Status eines einzelnen Downloadlinks setzen: als defekt markieren (Hinweis
 * auf der Projektseite), sperren (nicht mehr angezeigt, /go liefert 404) oder
 * wieder freigeben. Bei Sperre und Defekt erhält der Creator eine E-Mail.
 */
export async function moderateLinkAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await adminActor();
  if (!actor.ok) return actor.state;

  const id = adminIdSchema.safeParse(formData.get("linkId"));
  if (!id.success) return adminFail("not_found");
  const action = LINK_ACTIONS.find((a) => a === formData.get("action")) as LinkAction | undefined;
  if (!action) return adminFail("invalid_transition");
  const note = (linkActionNeedsNote(action) ? moderationNoteSchema : optionalModerationNoteSchema).safeParse(
    formData.get("note") ?? "",
  );
  if (!note.success) {
    return adminFail("validation", { note: note.error.issues[0]?.message === "tooLong" ? "tooLong" : "required" });
  }

  const link = await db.externalLink.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      url: true,
      status: true,
      version: {
        select: {
          version: true,
          project: {
            select: {
              id: true,
              slug: true,
              defaultLocale: true,
              translations: { select: { locale: true, title: true } },
              creator: { select: { email: true, name: true, preferredLocale: true, isSample: true } },
            },
          },
        },
      },
    },
  });
  if (!link) return adminFail("not_found");
  const next = nextLinkStatus(link.status, action);
  if (!next) return adminFail("invalid_transition");
  const project = link.version.project;

  const updated = await db.$transaction(async (tx) => {
    // Bedingt auf den gelesenen Status: gleichzeitige Entscheidungen überschreiben sich nicht.
    const result = await tx.externalLink.updateMany({
      where: { id: link.id, status: link.status },
      data: { status: next, moderationNote: next === "OK" ? null : note.data, lastCheckedAt: new Date() },
    });
    if (result.count === 0) return false;
    await tx.auditLog.create({
      data: {
        actorId: actor.admin.id,
        action: `link.${action}`,
        entityType: "ExternalLink",
        entityId: link.id,
        metadata: JSON.stringify({ projectId: project.id, from: link.status, to: next, ...(note.data ? { note: note.data } : {}) }),
      },
    });
    return true;
  });
  if (!updated) return adminFail("invalid_transition");

  // Beispielkonten haben keine echten Postfächer.
  if ((next === "BLOCKED" || next === "BROKEN") && !project.creator.isSample) {
    const locale = project.creator.preferredLocale ?? project.defaultLocale;
    const title = pickTranslation(project.translations, locale, project.defaultLocale)?.translation.title ?? project.slug;
    sendMailInBackground(
      linkStatusEmail(project.creator, { id: project.id, title }, { url: link.url, version: link.version.version }, next, note.data),
    );
  }

  projectsChanged([project.slug]);
  refresh();
  return { status: "success" };
}
