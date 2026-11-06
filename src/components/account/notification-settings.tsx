"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { setProjectUpdateMailsAction, type FavoriteErrorCode, type FavoriteState } from "@/server/actions/favorites";

const initialState: FavoriteState = { status: "idle" };

export type NotificationSettingsLabels = {
  label: string;
  save: string;
  saving: string;
  saved: string;
  errors: Record<FavoriteErrorCode, string>;
};

/** Einstellung „Mails bei neuen Versionen gemerkter Projekte“ (Checkbox, ohne JavaScript nutzbar). */
export function NotificationSettingsForm({ enabled, labels }: { enabled: boolean; labels: NotificationSettingsLabels }) {
  const [state, formAction] = useActionState(setProjectUpdateMailsAction, initialState);
  return (
    <form action={formAction} className="space-y-5">
      {state.status === "error" ? <FormAlert tone="error">{labels.errors[state.code]}</FormAlert> : null}
      {state.status === "success" ? <FormAlert tone="success">{labels.saved}</FormAlert> : null}
      <label className="flex cursor-pointer items-start gap-3 text-sm text-fg">
        <input
          type="checkbox"
          name="notifyProjectUpdates"
          defaultChecked={enabled}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
        />
        {labels.label}
      </label>
      <SubmitButton pendingLabel={labels.saving} variant="secondary">
        {labels.save}
      </SubmitButton>
    </form>
  );
}
