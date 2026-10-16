"use server";

import { refresh } from "next/cache";

import { banFormSchema, readBanForm } from "@/lib/admin-forms";
import { db } from "@/lib/db";
import { fieldErrorsFrom } from "@/lib/form-state";
import { banExpiresAt, canBanUser, type BanDuration } from "@/lib/moderation";
import { adminActor, adminFail, adminIdSchema, type AdminState } from "@/server/admin-action";

/**
 * Sperrt ein Konto: beendet alle Sitzungen, eine Anmeldung ist bis zum Ablauf
 * nicht mehr möglich (Better Auth prüft `banned`/`banExpires` beim Login und
 * hebt abgelaufene Sperren dabei selbst auf). Optional werden alle
 * veröffentlichten Projekte des Kontos ausgeblendet.
 */
export async function banUserAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await adminActor();
  if (!actor.ok) return actor.state;

  const id = adminIdSchema.safeParse(formData.get("userId"));
  if (!id.success) return adminFail("not_found");
  const parsed = banFormSchema.safeParse(readBanForm(formData));
  if (!parsed.success) return adminFail("validation", fieldErrorsFrom(parsed.error));
  const { reason, hideProjects } = parsed.data;
  const duration = parsed.data.duration as BanDuration;

  const target = await db.user.findUnique({ where: { id: id.data }, select: { id: true, role: true } });
  if (!target) return adminFail("not_found");
  if (!canBanUser(actor.admin, target)) return adminFail("forbidden_target");

  const expires = banExpiresAt(duration);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: { banned: true, banReason: reason, banExpires: expires },
    });
    await tx.session.deleteMany({ where: { userId: target.id } });
    let hidden: string[] = [];
    if (hideProjects) {
      const projects = await tx.project.findMany({
        where: { creatorId: target.id, status: "PUBLISHED" },
        select: { id: true },
      });
      hidden = projects.map((p) => p.id);
      await tx.project.updateMany({
        where: { id: { in: hidden } },
        data: { status: "HIDDEN", moderationNote: reason },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.admin.id,
        action: "user.ban",
        entityType: "User",
        entityId: target.id,
        metadata: JSON.stringify({ reason, duration, expires: expires?.toISOString() ?? null, hiddenProjects: hidden }),
      },
    });
  });

  refresh();
  return { status: "success" };
}

/** Hebt eine Sperre auf. Ausgeblendete Projekte bleiben ausgeblendet (einzeln prüfen). */
export async function unbanUserAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await adminActor();
  if (!actor.ok) return actor.state;

  const id = adminIdSchema.safeParse(formData.get("userId"));
  if (!id.success) return adminFail("not_found");
  const target = await db.user.findUnique({ where: { id: id.data }, select: { id: true, banned: true } });
  if (!target) return adminFail("not_found");
  if (!target.banned) return adminFail("invalid_transition");

  await db.$transaction([
    db.user.update({ where: { id: target.id }, data: { banned: false, banReason: null, banExpires: null } }),
    db.auditLog.create({
      data: { actorId: actor.admin.id, action: "user.unban", entityType: "User", entityId: target.id },
    }),
  ]);

  refresh();
  return { status: "success" };
}
