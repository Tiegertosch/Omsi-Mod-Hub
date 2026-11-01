"use server";

import { refresh } from "next/cache";

import {
  APPEAL_DECISIONS,
  appealMessageSchema,
  appealNoteSchema,
  appealStatusFor,
  parseAppealToken,
  statusReversedOnGrant,
  type AppealDecision,
} from "@/lib/appeals";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { pickTranslation } from "@/lib/translation";
import { adminActor, adminFail, adminIdSchema, type AdminState } from "@/server/admin-action";
import { hashAppealToken } from "@/server/appeals";
import { appealResultEmail } from "@/server/emails";
import { sendMailInBackground } from "@/server/mail";
import { projectsChanged } from "@/server/public-cache";
import { clientKey, consumeRateLimit } from "@/server/rate-limit";

export type AppealErrorCode = "validation" | "rate_limit" | "invalid_link" | "closed" | "generic";
export type AppealFormState = FormState<AppealErrorCode, "required" | "tooLong">;

const HOUR = 60 * 60 * 1000;

/**
 * Widerspruch gegen eine Moderationsentscheidung. Berechtigt ist, wer den
 * geheimen Link aus der E-Mail hat; ein Login ist nicht nötig. Pro
 * Entscheidung ist genau ein Widerspruch innerhalb der Frist möglich.
 */
export async function submitAppealAction(_prev: AppealFormState, formData: FormData): Promise<AppealFormState> {
  const token = parseAppealToken(formData.get("token"));
  if (!token) return { status: "error", code: "invalid_link" };

  const raw = formData.get("message");
  const message = appealMessageSchema.safeParse(typeof raw === "string" ? raw : "");
  if (!message.success) {
    const code = message.error.issues[0]?.message === "tooLong" ? "tooLong" : "required";
    return {
      status: "error",
      code: "validation",
      fieldErrors: { message: code },
      values: { message: typeof raw === "string" ? raw : "" },
    };
  }

  if (!(await consumeRateLimit(await clientKey("appeal"), 10, HOUR))) {
    return { status: "error", code: "rate_limit", values: { message: message.data } };
  }

  const now = new Date();
  const outcome = await db.$transaction(async (tx) => {
    const decision = await tx.moderationDecision.findUnique({
      where: { appealTokenHash: hashAppealToken(token) },
      select: { id: true, projectId: true },
    });
    if (!decision) return "invalid_link" as const;
    // Bedingt: nur ohne bisherigen Widerspruch und innerhalb der Frist.
    const updated = await tx.moderationDecision.updateMany({
      where: { id: decision.id, appealStatus: "NONE", appealUntil: { gt: now } },
      data: { appealStatus: "OPEN", appealMessage: message.data, appealedAt: now },
    });
    if (updated.count === 0) return "closed" as const;
    await tx.auditLog.create({
      data: {
        actorId: null,
        action: "appeal.create",
        entityType: "Project",
        entityId: decision.projectId,
        metadata: JSON.stringify({ decisionId: decision.id }),
      },
    });
    return "ok" as const;
  });
  if (outcome !== "ok") return { status: "error", code: outcome };

  refresh();
  return { status: "success" };
}

/**
 * Entscheidung über einen Widerspruch. Beim Stattgeben wird das Projekt wieder
 * veröffentlicht, sofern es noch im Status der ursprünglichen Entscheidung ist;
 * der Creator erhält das Ergebnis mit Begründung per E-Mail.
 */
export async function resolveAppealAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await adminActor();
  if (!actor.ok) return actor.state;

  const id = adminIdSchema.safeParse(formData.get("decisionId"));
  if (!id.success) return adminFail("not_found");
  const decision = APPEAL_DECISIONS.find((d) => d === formData.get("decision")) as AppealDecision | undefined;
  if (!decision) return adminFail("invalid_transition");
  const note = appealNoteSchema.safeParse(formData.get("note") ?? "");
  if (!note.success) {
    return adminFail("validation", { note: note.error.issues[0]?.message === "tooLong" ? "tooLong" : "required" });
  }

  const record = await db.moderationDecision.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      kind: true,
      appealStatus: true,
      project: {
        select: {
          id: true,
          slug: true,
          defaultLocale: true,
          publishedAt: true,
          translations: { select: { locale: true, title: true } },
          creator: { select: { email: true, name: true, preferredLocale: true, isSample: true } },
        },
      },
    },
  });
  if (!record) return adminFail("not_found");
  if (record.appealStatus !== "OPEN") return adminFail("invalid_transition");
  const project = record.project;

  const now = new Date();
  const outcome = await db.$transaction(async (tx) => {
    // Bedingt: Bei gleichzeitigen Entscheidungen gewinnt nur die erste.
    const resolved = await tx.moderationDecision.updateMany({
      where: { id: record.id, appealStatus: "OPEN" },
      data: { appealStatus: appealStatusFor(decision), resolvedById: actor.admin.id, resolvedAt: now, resolutionNote: note.data },
    });
    if (resolved.count === 0) return null;

    let restored = false;
    if (decision === "grant") {
      const result = await tx.project.updateMany({
        where: { id: project.id, status: statusReversedOnGrant(record.kind) },
        data: { status: "PUBLISHED", moderationNote: null, ...(project.publishedAt ? {} : { publishedAt: now }) },
      });
      restored = result.count > 0;
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.admin.id,
        action: `appeal.${decision}`,
        entityType: "Project",
        entityId: project.id,
        metadata: JSON.stringify({ decisionId: record.id, kind: record.kind, restored }),
      },
    });
    return { restored };
  });
  if (!outcome) return adminFail("invalid_transition");

  // Beispielkonten haben keine echten Postfächer.
  if (!project.creator.isSample) {
    const locale = project.creator.preferredLocale ?? project.defaultLocale;
    const title = pickTranslation(project.translations, locale, project.defaultLocale)?.translation.title ?? project.slug;
    sendMailInBackground(
      appealResultEmail(
        project.creator,
        { id: project.id, slug: project.slug, title },
        { granted: decision === "grant", restored: outcome.restored, note: note.data },
      ),
    );
  }

  if (outcome.restored) projectsChanged([project.slug]);
  refresh();
  return { status: "success" };
}
