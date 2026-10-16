"use client";

import { useTranslations } from "next-intl";

import { useEditorForm } from "@/components/editor/use-editor-form";
import { FormAlert, TextAreaField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import { PROJECT_LIMITS } from "@/lib/project-rules";
import { approveProjectAction, rejectProjectAction } from "@/server/actions/review";

export function ReviewActions({ projectId }: { projectId: string }) {
  const t = useTranslations("Review");
  const approve = useEditorForm(approveProjectAction);
  const reject = useEditorForm(rejectProjectAction);

  // Nach einer Entscheidung lädt die Liste neu; das Projekt verschwindet aus der Ansicht.
  return (
    <div className="space-y-3">
      {approve.formError ? <FormAlert tone="error">{approve.formError}</FormAlert> : null}
      <form action={approve.formAction} onSubmit={approve.onSubmit}>
        <input type="hidden" name="projectId" value={projectId} />
        <PendingButton pending={approve.pending} pendingLabel={approve.t("saving")} size="sm">
          {t("approve")}
        </PendingButton>
      </form>
      <details className="rounded-lg border border-border bg-surface-2">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted hover:text-fg">{t("reject")}</summary>
        <form action={reject.formAction} onSubmit={reject.onSubmit} className="space-y-3 border-t border-border p-3" noValidate>
          <input type="hidden" name="projectId" value={projectId} />
          {reject.formError ? <FormAlert tone="error">{reject.formError}</FormAlert> : null}
          <TextAreaField
            id={`reject-note-${projectId}`}
            name="note"
            label={t("rejectNote")}
            rows={3}
            maxLength={PROJECT_LIMITS.moderationNote}
            hint={t("rejectNoteHint")}
            error={reject.fieldError("note")}
          />
          <PendingButton pending={reject.pending} pendingLabel={reject.t("saving")} variant="secondary" size="sm">
            {t("reject")}
          </PendingButton>
        </form>
      </details>
    </div>
  );
}
