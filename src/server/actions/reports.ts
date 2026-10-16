"use server";

import { refresh } from "next/cache";

import { reportNoteSchema } from "@/lib/admin-forms";
import { db } from "@/lib/db";
import { isClosedReportStatus, nextReportStatus, REPORT_ACTIONS, type ReportAction } from "@/lib/moderation";
import { adminActor, adminFail, adminIdSchema, type AdminState } from "@/server/admin-action";

/** Ändert den Bearbeitungsstand einer Meldung; die Notiz bleibt intern. */
export async function updateReportAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await adminActor();
  if (!actor.ok) return actor.state;

  const id = adminIdSchema.safeParse(formData.get("reportId"));
  if (!id.success) return adminFail("not_found");
  const action = REPORT_ACTIONS.find((a) => a === formData.get("action")) as ReportAction | undefined;
  if (!action) return adminFail("invalid_transition");
  const note = reportNoteSchema.safeParse(formData.get("note") ?? "");
  if (!note.success) return adminFail("validation", { note: "tooLong" });

  const report = await db.report.findUnique({ where: { id: id.data }, select: { id: true, status: true } });
  if (!report) return adminFail("not_found");
  const next = nextReportStatus(report.status, action);
  if (!next) return adminFail("invalid_transition");

  const closed = isClosedReportStatus(next);
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.report.updateMany({
      where: { id: report.id, status: report.status },
      data: {
        status: next,
        resolvedById: closed ? actor.admin.id : null,
        resolvedAt: closed ? new Date() : null,
        // Leeres Feld überschreibt eine vorhandene Notiz nicht.
        ...(note.data ? { resolutionNote: note.data } : {}),
      },
    });
    if (result.count === 0) return false;
    await tx.auditLog.create({
      data: {
        actorId: actor.admin.id,
        action: `report.${action}`,
        entityType: "Report",
        entityId: report.id,
        metadata: JSON.stringify({ from: report.status, to: next }),
      },
    });
    return true;
  });
  if (!updated) return adminFail("invalid_transition");

  refresh();
  return { status: "success" };
}
