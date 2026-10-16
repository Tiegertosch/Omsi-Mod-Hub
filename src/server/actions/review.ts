"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { moderationNoteSchema } from "@/lib/admin-forms";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { nextStatusForAdmin, requiresModerationNote, type AdminProjectAction } from "@/lib/moderation";
import type { EditorErrorCode, EditorFieldCode } from "@/lib/project-form";
import { isAdmin } from "@/lib/roles";
import { pickTranslation } from "@/lib/translation";
import { projectDecisionEmail } from "@/server/emails";
import { sendMailInBackground } from "@/server/mail";
import { getCurrentUser } from "@/server/session";

type ReviewState = FormState<EditorErrorCode, EditorFieldCode>;

/** Nur Admins; die Berechtigung wird in jeder Action erneut geprüft. */
async function currentAdmin() {
  const user = await getCurrentUser();
  return user && isAdmin(user.role) ? user : null;
}

const idSchema = z.string().min(1).max(64);

/**
 * Gemeinsamer Ablauf aller Moderationsentscheidungen: Berechtigung,
 * Statusübergang, Begründung, Audit-Log und Benachrichtigung des Creators.
 */
async function moderateProject(action: AdminProjectAction, formData: FormData): Promise<ReviewState> {
  const admin = await currentAdmin();
  if (!admin) return { status: "error", code: "unauthorized" };
  const id = idSchema.safeParse(formData.get("projectId"));
  if (!id.success) return { status: "error", code: "not_found" };

  let note: string | null = null;
  if (requiresModerationNote(action)) {
    const parsed = moderationNoteSchema.safeParse(formData.get("note") ?? "");
    if (!parsed.success) {
      const code = parsed.error.issues[0]?.message === "tooLong" ? "tooLong" : "required";
      return { status: "error", code: "validation", fieldErrors: { note: code } };
    }
    note = parsed.data;
  }

  const project = await db.project.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      slug: true,
      status: true,
      defaultLocale: true,
      publishedAt: true,
      translations: { select: { locale: true, title: true } },
      creator: { select: { email: true, name: true, preferredLocale: true, isSample: true } },
    },
  });
  if (!project) return { status: "error", code: "not_found" };
  const next = nextStatusForAdmin(project.status, action);
  if (!next) return { status: "error", code: "invalid_transition" };

  // Bedingtes Update: Bei gleichzeitigen Entscheidungen gewinnt nur die erste.
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.project.updateMany({
      where: { id: project.id, status: project.status },
      data: {
        status: next,
        moderationNote: note,
        ...(next === "PUBLISHED" && !project.publishedAt ? { publishedAt: new Date() } : {}),
      },
    });
    if (result.count === 0) return false;
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: `project.${action}`,
        entityType: "Project",
        entityId: project.id,
        metadata: JSON.stringify({ from: project.status, to: next, ...(note ? { note } : {}) }),
      },
    });
    return true;
  });
  if (!updated) return { status: "error", code: "invalid_transition" };

  // Beispielkonten haben keine echten Postfächer.
  if (!project.creator.isSample) {
    const locale = project.creator.preferredLocale ?? project.defaultLocale;
    const title = pickTranslation(project.translations, locale, project.defaultLocale)?.translation.title ?? project.slug;
    sendMailInBackground(projectDecisionEmail(project.creator, { id: project.id, slug: project.slug, title }, action, note));
  }

  refresh();
  return { status: "success" };
}

export async function approveProjectAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  return moderateProject("approve", formData);
}

export async function rejectProjectAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  return moderateProject("reject", formData);
}

export async function hideProjectAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  return moderateProject("hide", formData);
}

export async function unhideProjectAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  return moderateProject("unhide", formData);
}
