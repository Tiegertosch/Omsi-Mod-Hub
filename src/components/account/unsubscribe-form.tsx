"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { unsubscribeAction, type FavoriteErrorCode, type FavoriteState } from "@/server/actions/favorites";

const initialState: FavoriteState = { status: "idle" };

export type UnsubscribeLabels = {
  text: string;
  button: string;
  pending: string;
  done: string;
  undo: string;
  errors: Record<FavoriteErrorCode, string>;
};

/**
 * Abmelden per Knopf (ohne Anmeldung, ohne JavaScript nutzbar). Konto-ID und
 * Signatur aus dem Link gehen als versteckte Felder mit.
 */
export function UnsubscribeForm({ userId, signature, labels }: { userId: string; signature: string; labels: UnsubscribeLabels }) {
  const [state, formAction] = useActionState(unsubscribeAction, initialState);

  if (state.status === "success") {
    return (
      <div className="space-y-3">
        <FormAlert tone="success">{labels.done}</FormAlert>
        <p className="text-sm text-muted">{labels.undo}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.status === "error" ? <FormAlert tone="error">{labels.errors[state.code]}</FormAlert> : null}
      <input type="hidden" name="u" value={userId} />
      <input type="hidden" name="s" value={signature} />
      <p className="text-sm text-muted">{labels.text}</p>
      <SubmitButton pendingLabel={labels.pending} className="w-full">
        {labels.button}
      </SubmitButton>
    </form>
  );
}
