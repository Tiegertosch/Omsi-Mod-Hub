"use client";

import { useTranslations } from "next-intl";

import { useEditorForm } from "@/components/editor/use-editor-form";
import { FormAlert, TextAreaField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { PROJECT_LIMITS } from "@/lib/project-rules";
import {
  approveProjectAction,
  hideProjectAction,
  rejectProjectAction,
  unhideProjectAction,
} from "@/server/actions/review";

type ModerationAction = typeof approveProjectAction;

/** Ein-Klick-Entscheidung ohne Begründung (Freigeben, Wiedereinblenden). */
function DirectAction({ projectId, action, label }: { projectId: string; action: ModerationAction; label: string }) {
  const form = useEditorForm(action);
  return (
    <div className="space-y-2">
      {form.formError ? <FormAlert tone="error">{form.formError}</FormAlert> : null}
      <form action={form.formAction} onSubmit={form.onSubmit}>
        <input type="hidden" name="projectId" value={projectId} />
        <PendingButton pending={form.pending} pendingLabel={form.t("saving")} size="sm">
          {label}
        </PendingButton>
      </form>
    </div>
  );
}

/** Entscheidung mit Pflichtbegründung für den Creator (Zurückweisen, Ausblenden). */
function NoteAction({
  projectId,
  action,
  label,
  noteLabel,
  noteHint,
  idPrefix,
}: {
  projectId: string;
  action: ModerationAction;
  label: string;
  noteLabel: string;
  noteHint: string;
  /** eindeutig pro Seite, falls dasselbe Projekt mehrfach erscheint (Meldungen) */
  idPrefix: string;
}) {
  const form = useEditorForm(action);
  return (
    <details className="rounded-lg border border-border bg-surface-2">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted hover:text-fg">{label}</summary>
      <form action={form.formAction} onSubmit={form.onSubmit} className="space-y-3 border-t border-border p-3" noValidate>
        <input type="hidden" name="projectId" value={projectId} />
        {form.formError ? <FormAlert tone="error">{form.formError}</FormAlert> : null}
        <TextAreaField
          id={`${idPrefix}-note`}
          name="note"
          label={noteLabel}
          rows={3}
          maxLength={PROJECT_LIMITS.moderationNote}
          hint={noteHint}
          error={form.fieldError("note")}
        />
        <PendingButton pending={form.pending} pendingLabel={form.t("saving")} variant="secondary" size="sm">
          {label}
        </PendingButton>
      </form>
    </details>
  );
}

/**
 * Passende Moderationsaktionen zum Projektstatus. Nach einer Entscheidung
 * lädt die Liste neu; das Projekt wechselt in die Ansicht des neuen Status.
 */
export function ProjectModeration({
  projectId,
  status,
  instanceId = projectId,
}: {
  projectId: string;
  status: ProjectStatus;
  instanceId?: string;
}) {
  const t = useTranslations("Review");

  if (status === "PENDING_REVIEW") {
    return (
      <div className="space-y-3">
        <DirectAction projectId={projectId} action={approveProjectAction} label={t("approve")} />
        <NoteAction
          projectId={projectId}
          action={rejectProjectAction}
          label={t("reject")}
          noteLabel={t("rejectNote")}
          noteHint={t("rejectNoteHint")}
          idPrefix={`reject-${instanceId}`}
        />
      </div>
    );
  }
  if (status === "PUBLISHED") {
    return (
      <NoteAction
        projectId={projectId}
        action={hideProjectAction}
        label={t("hide")}
        noteLabel={t("hideNote")}
        noteHint={t("hideNoteHint")}
        idPrefix={`hide-${instanceId}`}
      />
    );
  }
  if (status === "HIDDEN") {
    return <DirectAction projectId={projectId} action={unhideProjectAction} label={t("unhide")} />;
  }
  return null;
}
