"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { fieldErrorsFrom, type FormState } from "@/lib/form-state";
import { creatorProfileSchema, readCreatorProfileForm, type EditorErrorCode, type EditorFieldCode } from "@/lib/project-form";
import { hasRole } from "@/lib/roles";
import { consumeRateLimit } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/session";
import { creatorChanged } from "@/server/public-cache";

type EditorState = FormState<EditorErrorCode, EditorFieldCode>;

/**
 * Creator werden: Für das MVP kann jedes bestätigte Konto den Creator-Status
 * selbst aktivieren. Die Rolle wird serverseitig ergänzt (nicht über die
 * Auth-API, dort ist sie kein Eingabefeld) und im Audit-Log protokolliert.
 */
export async function becomeCreatorAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const user = await getCurrentUser();
  if (!user || !user.emailVerified) return { status: "error", code: "unauthorized" };
  if (!(await consumeRateLimit(`creator-profile:user:${user.id}`, 20, 10 * 60 * 1000))) {
    return { status: "error", code: "rate_limit" };
  }

  const parsed = creatorProfileSchema.safeParse(readCreatorProfileForm(formData));
  if (!parsed.success) {
    return { status: "error", code: "validation", fieldErrors: fieldErrorsFrom<EditorFieldCode>(parsed.error) };
  }

  const roles = user.role.split(",").map((r) => r.trim()).filter(Boolean);
  const nextRole = hasRole(user.role, "creator") ? user.role : roles.filter((r) => r !== "user").concat("creator").join(",");

  await db.$transaction([
    db.creatorProfile.upsert({
      where: { userId: user.id },
      update: parsed.data,
      create: { ...parsed.data, userId: user.id },
    }),
    db.user.update({ where: { id: user.id }, data: { role: nextRole } }),
    db.auditLog.create({
      data: {
        actorId: user.id,
        action: "user.creator.activate",
        entityType: "User",
        entityId: user.id,
        metadata: JSON.stringify({ from: user.role, to: nextRole }),
      },
    }),
  ]);

  const locale = z.enum(routing.locales).catch(routing.defaultLocale).parse(formData.get("locale"));
  redirect(`/${locale}/dashboard/projects`);
}

export async function updateCreatorProfileAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", code: "unauthorized" };
  if (!(await consumeRateLimit(`creator-profile:user:${user.id}`, 20, 10 * 60 * 1000))) {
    return { status: "error", code: "rate_limit" };
  }

  const profile = await db.creatorProfile.findUnique({ where: { userId: user.id }, select: { userId: true } });
  if (!profile) return { status: "error", code: "not_found" };

  const parsed = creatorProfileSchema.safeParse(readCreatorProfileForm(formData));
  if (!parsed.success) {
    return { status: "error", code: "validation", fieldErrors: fieldErrorsFrom<EditorFieldCode>(parsed.error) };
  }
  await db.creatorProfile.update({ where: { userId: user.id }, data: parsed.data });
  creatorChanged(user.username);
  refresh();
  return { status: "success" };
}
