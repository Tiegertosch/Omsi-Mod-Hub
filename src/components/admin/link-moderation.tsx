"use client";

import { Badge } from "@/components/ui/badge";
import { FormAlert, TextAreaField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import type { LinkStatus } from "@/generated/prisma/enums";
import { availableLinkActions } from "@/lib/moderation";
import { PROJECT_LIMITS } from "@/lib/project-rules";
import { moderateLinkAction } from "@/server/actions/links";

import { useAdminForm } from "./use-admin-form";

export type ModeratedLink = {
  id: string;
  url: string;
  version: string;
  status: LinkStatus;
  moderationNote: string | null;
};

const STATUS_TONES = { UNCHECKED: "neutral", OK: "success", BROKEN: "warning", BLOCKED: "danger" } as const;

function LinkRow({ link }: { link: ModeratedLink }) {
  const { t, formAction, onSubmit, pending, formError, fieldError } = useAdminForm(moderateLinkAction);
  const actions = availableLinkActions(link.status);

  return (
    <li className="rounded-md border border-border bg-surface-2 p-3">
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
          <Badge tone={STATUS_TONES[link.status]}>{t(`links.status.${link.status}`)}</Badge>
          <span className="text-subtle">{link.version}</span>
          {/* Nur als Text: Admins sollen das Ziel prüfen können, ohne es versehentlich zu öffnen. */}
          <span className="min-w-0 break-all text-muted">{link.url}</span>
        </summary>
        {link.moderationNote ? (
          <p className="mt-2 text-sm text-muted">
            <span className="font-medium text-fg">{t("links.currentNote")}</span> {link.moderationNote}
          </p>
        ) : null}
        <form action={formAction} onSubmit={onSubmit} className="mt-3 space-y-3" noValidate>
          <input type="hidden" name="linkId" value={link.id} />
          {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
          <TextAreaField
            id={`link-note-${link.id}`}
            name="note"
            label={t("links.note")}
            hint={t("links.noteHint")}
            rows={2}
            maxLength={PROJECT_LIMITS.moderationNote}
            error={fieldError("note")}
          />
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <PendingButton
                key={action}
                name="action"
                value={action}
                pending={pending}
                pendingLabel={t("saving")}
                variant={action === "block" ? "danger" : "secondary"}
                size="sm"
              >
                {t(`links.actions.${action}`)}
              </PendingButton>
            ))}
          </div>
        </form>
      </details>
    </li>
  );
}

/** Downloadlinks eines gemeldeten Projekts: als defekt markieren, sperren oder freigeben. */
export function LinkModeration({ links }: { links: ModeratedLink[] }) {
  if (links.length === 0) return null;
  return (
    <ul className="space-y-2">
      {links.map((link) => (
        <LinkRow key={link.id} link={link} />
      ))}
    </ul>
  );
}
