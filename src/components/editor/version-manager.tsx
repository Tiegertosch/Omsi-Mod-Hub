"use client";

import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { buttonStyles } from "@/components/ui/button";
import { FormAlert, SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import { LinkSourceType } from "@/generated/prisma/enums";
import { MAX_EXTERNAL_URL_LENGTH } from "@/lib/external-url";
import { PROJECT_LIMITS } from "@/lib/project-rules";
import { deleteVersionAction, saveVersionAction } from "@/server/actions/projects";

import { useEditorForm } from "./use-editor-form";

export type EditorVersion = {
  id: string;
  version: string;
  changelog: string;
  releasedAt: Date;
  links: { id: string; url: string; label: string; sourceType: LinkSourceType }[];
};

const SOURCE_TYPES = Object.values(LinkSourceType);

function VersionForm({ projectId, version }: { projectId: string; version?: EditorVersion }) {
  const uid = useId();
  const linkT = useTranslations("ExternalLink");
  const { t, state, pending, onSubmit, formAction, fieldError, formError } = useEditorForm(saveVersionAction);
  const [rows, setRows] = useState(() =>
    (version?.links.length
      ? version.links
      : [{ id: "", url: "", label: "", sourceType: "ORIGINAL_SOURCE" as LinkSourceType }]
    ).map((link, index) => ({ key: `${uid}-${index}`, ...link })),
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const prefix = version ? `v-${version.id}` : "v-new";

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-5" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      {version ? <input type="hidden" name="versionId" value={version.id} /> : null}
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      {state.status === "success" && version ? <FormAlert tone="success">{t("versionSaved")}</FormAlert> : null}

      <TextField
        id={`${prefix}-version`}
        name="version"
        label={t("version")}
        defaultValue={version?.version}
        maxLength={PROJECT_LIMITS.version}
        hint={t("versionHint")}
        error={fieldError("version")}
      />
      <TextAreaField
        id={`${prefix}-changelog`}
        name="changelog"
        label={t("changelog")}
        defaultValue={version?.changelog}
        rows={4}
        maxLength={PROJECT_LIMITS.changelog}
        error={fieldError("changelog")}
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-fg">{t("links")}</legend>
        <p className="text-xs text-subtle">{t("linksHint")}</p>
        {fieldError("links") ? <p className="text-xs text-danger">{fieldError("links")}</p> : null}
        <ul className="space-y-4">
          {rows.map((row, index) => (
            <li key={row.key} className="rounded-lg border border-border bg-surface-2 p-3">
              <input type="hidden" name={`links.${index}.id`} value={row.id} />
              {/* URL in eigener Zeile, darunter Bezeichnung, Art und Entfernen */}
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <TextField
                  className="sm:col-span-3"
                  id={`${row.key}-url`}
                  name={`links.${index}.url`}
                  type="url"
                  label={t("linkUrl")}
                  defaultValue={row.url}
                  maxLength={MAX_EXTERNAL_URL_LENGTH}
                  placeholder="https://"
                  error={fieldError(`links.${index}.url`)}
                />
                <TextField
                  id={`${row.key}-label`}
                  name={`links.${index}.label`}
                  label={t("linkLabel")}
                  defaultValue={row.label}
                  maxLength={PROJECT_LIMITS.linkLabel}
                />
                <SelectField
                  id={`${row.key}-type`}
                  name={`links.${index}.sourceType`}
                  label={t("linkSourceType")}
                  defaultValue={row.sourceType}
                >
                  {SOURCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {linkT(`sourceType.${type}`)}
                    </option>
                  ))}
                </SelectField>
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                  className={buttonStyles({ variant: "ghost", size: "icon", className: "sm:mt-7" })}
                >
                  <X aria-hidden className="size-4" />
                  <span className="sr-only">{t("remove")}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
        {rows.length < PROJECT_LIMITS.linksPerVersion ? (
          <button
            type="button"
            onClick={() => {
              setRows((current) => [
                ...current,
                { key: `${uid}-n${nextKey}`, id: "", url: "", label: "", sourceType: "FILE_HOSTER" },
              ]);
              setNextKey((k) => k + 1);
            }}
            className={buttonStyles({ variant: "outline", size: "sm" })}
          >
            <Plus aria-hidden className="size-4" />
            {t("addLink")}
          </button>
        ) : null}
      </fieldset>

      <PendingButton pending={pending} pendingLabel={t("saving")} variant={version ? "secondary" : "primary"}>
        {version ? t("saveVersion") : t("createVersion")}
      </PendingButton>
    </form>
  );
}

function DeleteVersionForm({ projectId, versionId }: { projectId: string; versionId: string }) {
  const { t, pending, onSubmit, formAction, formError } = useEditorForm(deleteVersionAction);
  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="versionId" value={versionId} />
      <PendingButton pending={pending} pendingLabel={t("saving")} variant="ghost" size="sm">
        <Trash2 aria-hidden className="size-4" />
        {t("deleteVersion")}
      </PendingButton>
      {formError ? <p role="alert" className="text-xs text-danger">{formError}</p> : null}
    </form>
  );
}

export function VersionManager({ projectId, versions }: { projectId: string; versions: EditorVersion[] }) {
  const t = useTranslations("Editor");
  const format = useFormatter();

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t("versionsIntro")}</p>

      {versions.length > 0 ? (
        <ul className="space-y-3">
          {versions.map((version) => (
            <li key={version.id}>
              <details className="group rounded-lg border border-border bg-surface-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="font-semibold text-fg">{version.version}</span>
                    <span className="ml-2 text-xs text-subtle">
                      {t("releasedAt", { date: format.dateTime(version.releasedAt, { dateStyle: "medium" }) })} ·{" "}
                      {version.links.length} {t("links")}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-sm text-muted">
                    {t("editVersion")}
                    <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <div className="space-y-5 border-t border-border p-4">
                  <VersionForm projectId={projectId} version={version} />
                  <div className="border-t border-border pt-4">
                    <DeleteVersionForm projectId={projectId} versionId={version.id} />
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t("noVersions")}</p>
      )}

      <details open={versions.length === 0} className="rounded-lg border border-dashed border-border-strong">
        <summary className="cursor-pointer px-4 py-3 font-semibold text-fg">{t("newVersion")}</summary>
        <div className="border-t border-border p-4">
          {/* Neuer Schlüssel nach jeder angelegten Version → leeres Formular */}
          <VersionForm key={versions.length} projectId={projectId} />
        </div>
      </details>
    </div>
  );
}
