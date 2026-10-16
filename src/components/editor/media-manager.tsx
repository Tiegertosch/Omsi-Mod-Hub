"use client";

import { ImageOff, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useRef } from "react";

import { FormAlert, TextField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import { PROJECT_LIMITS } from "@/lib/project-rules";
import {
  deleteScreenshotAction,
  removeCoverAction,
  uploadCoverAction,
  uploadScreenshotAction,
} from "@/server/actions/projects";

import { useEditorForm, type EditorState } from "./use-editor-form";

const ACCEPT = "image/jpeg,image/png,image/webp";

/** Leert das Formular nach erfolgreichem Upload (Datei- und Textfeld). */
function useResetOnSuccess(state: EditorState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") ref.current?.reset();
  }, [state]);
  return ref;
}

function UploadForm({
  projectId,
  kind,
}: {
  projectId: string;
  kind: "cover" | "screenshot";
}) {
  const { t, state, pending, onSubmit, formAction, fieldError, formError } = useEditorForm(
    kind === "cover" ? uploadCoverAction : uploadScreenshotAction,
  );
  const formRef = useResetOnSuccess(state);
  const prefix = `${kind}-upload`;

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      {state.status === "success" ? <FormAlert tone="success">{t("uploaded")}</FormAlert> : null}
      <TextField
        id={`${prefix}-file`}
        name="file"
        type="file"
        accept={ACCEPT}
        required
        label={t("file")}
        error={fieldError("file")}
        className="[&_input]:h-auto [&_input]:py-2 [&_input]:file:mr-3 [&_input]:file:rounded-md [&_input]:file:border-0 [&_input]:file:bg-surface-3 [&_input]:file:px-3 [&_input]:file:py-1.5 [&_input]:file:text-fg"
      />
      <TextField
        id={`${prefix}-alt`}
        name="alt"
        label={t("alt")}
        required={kind === "screenshot"}
        maxLength={PROJECT_LIMITS.imageAlt}
        hint={t("altHint")}
        error={fieldError("alt")}
      />
      <PendingButton pending={pending} pendingLabel={t("uploading")} variant="secondary">
        <Upload aria-hidden className="size-4" />
        {kind === "cover" ? t("uploadCover") : t("uploadScreenshot")}
      </PendingButton>
    </form>
  );
}

function RemoveCoverForm({ projectId }: { projectId: string }) {
  const { t, pending, onSubmit, formAction, formError } = useEditorForm(removeCoverAction);
  return (
    <form action={formAction} onSubmit={onSubmit}>
      <input type="hidden" name="projectId" value={projectId} />
      <PendingButton pending={pending} pendingLabel={t("saving")} variant="ghost" size="sm">
        <Trash2 aria-hidden className="size-4" />
        {t("removeCover")}
      </PendingButton>
      {formError ? <p className="mt-1 text-xs text-danger">{formError}</p> : null}
    </form>
  );
}

function ScreenshotItem({ projectId, shot }: { projectId: string; shot: { id: string; url: string; alt: string } }) {
  const { t, pending, onSubmit, formAction, formError } = useEditorForm(deleteScreenshotAction);
  return (
    <li className="overflow-hidden rounded-lg border border-border bg-surface-2">
      <div className="relative aspect-video">
        <Image src={shot.url} alt={shot.alt} fill sizes="(min-width: 640px) 300px, 100vw" unoptimized className="object-cover" />
      </div>
      <div className="flex items-center justify-between gap-2 p-2">
        <p className="truncate text-xs text-muted" title={shot.alt}>
          {shot.alt}
        </p>
        <form action={formAction} onSubmit={onSubmit}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="screenshotId" value={shot.id} />
          <PendingButton pending={pending} pendingLabel="…" variant="ghost" size="icon" title={t("deleteScreenshot")}>
            <Trash2 aria-hidden className="size-4" />
            <span className="sr-only">{t("deleteScreenshot")}</span>
          </PendingButton>
        </form>
      </div>
      {formError ? <p className="px-2 pb-2 text-xs text-danger">{formError}</p> : null}
    </li>
  );
}

export function MediaManager({
  projectId,
  cover,
  screenshots,
}: {
  projectId: string;
  cover: { url: string; alt: string } | null;
  screenshots: { id: string; url: string; alt: string }[];
}) {
  const t = useTranslations("Editor");
  const labels = {
    cover: t("cover"),
    coverHint: t("coverHint"),
    noCover: t("noCover"),
    screenshots: t("screenshots"),
    screenshotsHint: t("screenshotsHint", { max: PROJECT_LIMITS.screenshots }),
    noScreenshots: t("noScreenshots"),
  };
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold text-fg">{labels.cover}</h3>
        <p className="mt-1 mb-4 text-xs text-subtle">{labels.coverHint}</p>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            {cover ? (
              <div className="space-y-2">
                <div className="relative aspect-video overflow-hidden rounded-lg border border-border">
                  <Image src={cover.url} alt={cover.alt} fill sizes="(min-width: 1024px) 400px, 100vw" unoptimized className="object-cover" />
                </div>
                <RemoveCoverForm projectId={projectId} />
              </div>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-sm text-subtle">
                <ImageOff aria-hidden className="size-6" />
                {labels.noCover}
              </div>
            )}
          </div>
          <UploadForm projectId={projectId} kind="cover" />
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-fg">{labels.screenshots}</h3>
        <p className="mt-1 mb-4 text-xs text-subtle">{labels.screenshotsHint}</p>
        {screenshots.length > 0 ? (
          <ul className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {screenshots.map((shot) => (
              <ScreenshotItem key={shot.id} projectId={projectId} shot={shot} />
            ))}
          </ul>
        ) : (
          <p className="mb-5 text-sm text-muted">{labels.noScreenshots}</p>
        )}
        {screenshots.length < PROJECT_LIMITS.screenshots ? (
          <div className="max-w-xl">
            <UploadForm projectId={projectId} kind="screenshot" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
