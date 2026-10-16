"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import type { EditorErrorCode, EditorFieldCode } from "@/lib/project-form";
import { PROJECT_LIMITS } from "@/lib/project-rules";
import { isAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/server/session";

type ReviewState = FormState<EditorErrorCode, EditorFieldCode>;

/** Nur Admins; die Berechtigung wird in jeder Action erneut geprüft. */
async function currentAdmin() {
  const user = await getCurrentUser();
  return user && isAdmin(user.role) ? user : null;
}

const idSchema = z.string().min(1).max(64);

export async function approveProjectAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const admin = await currentAdmin();
  if (!admin) return { status: "error", code: "unauthorized" };
  const id = idSchema.safeParse(formData.get("projectId"));
  if (!id.success) return { status: "error", code: "not_found" };

  const project = await db.project.findUnique({ where: { id: id.data }, select: { id: true, status: true, publishedAt: true } });
  if (!project) return { status: "error", code: "not_found" };
  if (project.status !== "PENDING_REVIEW") return { status: "error", code: "invalid_transition" };

  await db.$transaction([
    db.project.update({
      where: { id: project.id },
      data: { status: "PUBLISHED", publishedAt: project.publishedAt ?? new Date(), moderationNote: null },
    }),
    db.auditLog.create({
      data: { actorId: admin.id, action: "project.approve", entityType: "Project", entityId: project.id },
    }),
  ]);
  refresh();
  return { status: "success" };
}

const noteSchema = z.string().trim().min(1, { message: "required" }).max(PROJECT_LIMITS.moderationNote, { message: "tooLong" });

export async function rejectProjectAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const admin = await currentAdmin();
  if (!admin) return { status: "error", code: "unauthorized" };
  const id = idSchema.safeParse(formData.get("projectId"));
  if (!id.success) return { status: "error", code: "not_found" };

  const note = noteSchema.safeParse(formData.get("note") ?? "");
  if (!note.success) {
    return {
      status: "error",
      code: "validation",
      fieldErrors: { note: note.error.issues[0]?.message === "tooLong" ? "tooLong" : "required" },
    };
  }

  const project = await db.project.findUnique({ where: { id: id.data }, select: { id: true, status: true } });
  if (!project) return { status: "error", code: "not_found" };
  if (project.status !== "PENDING_REVIEW") return { status: "error", code: "invalid_transition" };

  await db.$transaction([
    db.project.update({ where: { id: project.id }, data: { status: "REJECTED", moderationNote: note.data } }),
    db.auditLog.create({
      data: {
        actorId: admin.id,
        action: "project.reject",
        entityType: "Project",
        entityId: project.id,
        metadata: JSON.stringify({ note: note.data }),
      },
    }),
  ]);
  refresh();
  return { status: "success" };
}
