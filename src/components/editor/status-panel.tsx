"use client";

import { CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { FormAlert } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { CHECKLIST_TABS } from "@/lib/editor-tabs";
import { cn } from "@/lib/utils";
import type { ChecklistKey, CreatorStatusAction } from "@/lib/project-status";
import { changeProjectStatusAction } from "@/server/actions/projects";

import { showEditorTab, useOptionalEditorTabs } from "./editor-tabs";
import { STATUS_TONES } from "./status-tones";
import { useEditorForm } from "./use-editor-form";

export function StatusPanel({
  projectId,
  status,
  moderationNote,
  checklist,
  actions,
  reviewRequired,
}: {
  projectId: string;
  status: ProjectStatus;
  moderationNote: string | null;
  checklist: { key: ChecklistKey; ok: boolean; required: boolean }[];
  actions: CreatorStatusAction[];
  reviewRequired: boolean;
}) {
  const statusT = useTranslations("ProjectStatus");
  const projectsT = useTranslations("Projects");
  const { t, state, pending, onSubmit, formAction, formError } = useEditorForm(changeProjectStatusAction);
  const ready = checklist.every((item) => item.ok || !item.required);
  const tabs = useOptionalEditorTabs();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-subtle">{t("currentStatus")}</span>
        <Badge tone={STATUS_TONES[status]}>{statusT(status)}</Badge>
      </div>
      <p className="text-sm text-muted">{t(`statusHelp.${status}`)}</p>

      {moderationNote && (status === "REJECTED" || status === "HIDDEN") ? (
        <div className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm">
          <p className="font-semibold text-danger">{projectsT("moderationNote")}</p>
          <p className="mt-1 whitespace-pre-line text-fg/90">{moderationNote}</p>
        </div>
      ) : null}

      {actions.includes("submit") ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-fg">{t("checklistTitle")}</h3>
          <ul className="space-y-1.5">
            {checklist.map((item) => {
              const Icon = item.ok ? CircleCheck : item.required ? CircleX : CircleDashed;
              return (
                <li key={item.key} className="flex items-center gap-2 text-sm">
                  <Icon
                    aria-hidden
                    className={cn("size-4 shrink-0", item.ok ? "text-success" : item.required ? "text-danger" : "text-subtle")}
                  />
                  {/* Offene Punkte führen direkt zum Tab, in dem sie sich erledigen lassen. */}
                  {!item.ok && tabs?.tabs.includes(CHECKLIST_TABS[item.key]) ? (
                    <a
                      href={`#${CHECKLIST_TABS[item.key]}`}
                      onClick={(event) => {
                        event.preventDefault();
                        showEditorTab(tabs, CHECKLIST_TABS[item.key]);
                      }}
                      className="text-muted underline decoration-border underline-offset-4 hover:text-fg hover:decoration-current"
                    >
                      {t(`checklist.${item.key}`)}
                    </a>
                  ) : (
                    <span className={item.ok ? "text-fg" : "text-muted"}>{t(`checklist.${item.key}`)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      {state.status === "success" ? <FormAlert tone="success">{t("statusChanged")}</FormAlert> : null}

      {actions.length > 0 ? (
        <form action={formAction} onSubmit={onSubmit} className="flex flex-wrap gap-2">
          <input type="hidden" name="projectId" value={projectId} />
          {actions.map((action) => (
            <PendingButton
              key={action}
              name="action"
              value={action}
              pending={pending}
              pendingLabel={t("saving")}
              variant={action === "submit" ? "primary" : action === "archive" ? "ghost" : "secondary"}
              disabled={action === "submit" && !ready}
            >
              {action === "submit" && !reviewRequired ? t("actions.submitDirect") : t(`actions.${action}`)}
            </PendingButton>
          ))}
        </form>
      ) : null}
    </div>
  );
}
