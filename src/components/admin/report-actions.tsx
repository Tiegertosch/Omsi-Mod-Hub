"use client";

import { FormAlert, TextAreaField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import { ADMIN_LIMITS } from "@/lib/admin-forms";
import type { ReportAction } from "@/lib/moderation";
import { updateReportAction } from "@/server/actions/reports";

import { useAdminForm } from "./use-admin-form";

/** Bearbeitungsstand einer Meldung ändern, optional mit interner Notiz. */
export function ReportActions({ reportId, actions }: { reportId: string; actions: ReportAction[] }) {
  const { t, formAction, onSubmit, pending, formError, fieldError } = useAdminForm(updateReportAction);
  if (actions.length === 0) return null;

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-3" noValidate>
      <input type="hidden" name="reportId" value={reportId} />
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <TextAreaField
        id={`report-note-${reportId}`}
        name="note"
        label={t("reports.note")}
        hint={t("reports.noteHint")}
        rows={2}
        maxLength={ADMIN_LIMITS.reportNote}
        error={fieldError("note")}
      />
      <div className="flex flex-wrap gap-2">
        {actions.map((action, index) => (
          <PendingButton
            key={action}
            name="action"
            value={action}
            pending={pending}
            pendingLabel={t("saving")}
            variant={index === 0 ? "primary" : "secondary"}
            size="sm"
          >
            {t(`reports.actions.${action}`)}
          </PendingButton>
        ))}
      </div>
    </form>
  );
}
