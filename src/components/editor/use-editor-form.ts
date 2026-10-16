"use client";

import { useTranslations } from "next-intl";
import { useActionState, useTransition, type FormEvent } from "react";

import type { FormState } from "@/lib/form-state";
import type { EditorErrorCode, EditorFieldCode } from "@/lib/project-form";

export type EditorState = FormState<EditorErrorCode, EditorFieldCode>;
type EditorAction = (state: EditorState, formData: FormData) => Promise<EditorState>;

const initialState: EditorState = { status: "idle" };

/**
 * Formular-Hook für den Editor. Sendet per Transition statt über das
 * `action`-Attribut, damit React das Formular nach dem Absenden nicht
 * zurücksetzt – bei Validierungsfehlern bleiben alle Eingaben erhalten.
 * Ohne JavaScript funktioniert das Formular weiterhin über `action`.
 */
export function useEditorForm(action: EditorAction) {
  const t = useTranslations("Editor");
  const [state, formAction, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter instanceof HTMLButtonElement ? submitter : undefined);
    startTransition(() => formAction(formData));
  };

  const fieldError = (name: string) => {
    if (state.status !== "error") return undefined;
    const code = state.fieldErrors?.[name];
    return code ? t(`fieldErrors.${code}`) : undefined;
  };

  const hasErrorWithPrefix = (prefix: string) =>
    state.status === "error" && Object.keys(state.fieldErrors ?? {}).some((key) => key.startsWith(prefix));

  const formError = state.status === "error" ? t(`errors.${state.code}`) : undefined;

  return { t, state, formAction, pending, onSubmit, fieldError, formError, hasErrorWithPrefix };
}
