"use client";

import { FormAlert, TextAreaField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import { APPEAL_DECISIONS, APPEAL_NOTE_MAX } from "@/lib/appeals";
import { resolveAppealAction } from "@/server/actions/appeals";

import { useAdminForm } from "./use-admin-form";

/** Über einen offenen Widerspruch entscheiden; die Begründung geht an den Creator. */
export function AppealActions({ decisionId }: { decisionId: string }) {
  const { t, formAction, onSubmit, pending, formError, fieldError } = useAdminForm(resolveAppealAction);

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-3" noValidate>
      <input type="hidden" name="decisionId" value={decisionId} />
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <TextAreaField
        id={`appeal-note-${decisionId}`}
        name="note"
        label={t("appeals.note")}
        hint={t("appeals.noteHint")}
        rows={3}
        required
        maxLength={APPEAL_NOTE_MAX}
        error={fieldError("note")}
      />
      <div className="flex flex-wrap gap-2">
        {APPEAL_DECISIONS.map((decision, index) => (
          <PendingButton
            key={decision}
            name="decision"
            value={decision}
            pending={pending}
            pendingLabel={t("saving")}
            variant={index === 0 ? "primary" : "secondary"}
            size="sm"
          >
            {t(`appeals.${decision}`)}
          </PendingButton>
        ))}
      </div>
    </form>
  );
}
