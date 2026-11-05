"use client";

import { useLocale } from "next-intl";

import { CodeInput } from "@/components/auth/code-input";
import { FormAlert } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import { PROJECT_DELETION_CODE_LENGTH, PROJECT_DELETION_CODE_MINUTES } from "@/lib/project-deletion-rules";
import { confirmProjectDeletionAction, requestProjectDeletionAction } from "@/server/actions/projects";

import { useEditorForm } from "./use-editor-form";

/**
 * Projekt löschen in zwei Schritten: Code per E-Mail anfordern, dann eingeben.
 * Ob das Eingabefeld erscheint, entscheidet der Server (gültiger Code
 * vorhanden), damit der Ablauf auch nach einem Neuladen und ohne JavaScript
 * funktioniert.
 */
export function DeleteProjectPanel({ projectId, codePending }: { projectId: string; codePending: boolean }) {
  const locale = useLocale();
  const request = useEditorForm(requestProjectDeletionAction);
  const confirm = useEditorForm(confirmProjectDeletionAction);
  const t = request.t;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t("deletion.intro")}</p>

      {request.formError ? <FormAlert tone="error">{request.formError}</FormAlert> : null}
      {codePending ? (
        <FormAlert tone="success">{t("deletion.codeSent", { minutes: PROJECT_DELETION_CODE_MINUTES })}</FormAlert>
      ) : null}

      {codePending ? (
        <form action={confirm.formAction} onSubmit={confirm.onSubmit} className="space-y-3" noValidate>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="locale" value={locale} />
          {confirm.formError && confirm.state.status === "error" && confirm.state.code !== "validation" ? (
            <FormAlert tone="error">{confirm.formError}</FormAlert>
          ) : null}
          <div className="max-w-sm">
            <CodeInput
              id="deletion-code"
              length={PROJECT_DELETION_CODE_LENGTH}
              label={t("deletion.codeLabel")}
              error={confirm.fieldError("code")}
              autoFocus={false}
            />
          </div>
          <PendingButton pending={confirm.pending} pendingLabel={t("deletion.deleting")} variant="danger">
            {t("deletion.confirm")}
          </PendingButton>
        </form>
      ) : null}

      <form action={request.formAction} onSubmit={request.onSubmit}>
        <input type="hidden" name="projectId" value={projectId} />
        <PendingButton
          pending={request.pending}
          pendingLabel={t("deletion.sending")}
          variant={codePending ? "ghost" : "secondary"}
          size="sm"
        >
          {codePending ? t("deletion.requestAgain") : t("deletion.request")}
        </PendingButton>
      </form>
    </div>
  );
}
