"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useTransition, type FormEvent } from "react";

import type { AdminState } from "@/server/admin-action";

type AdminAction = (state: AdminState, formData: FormData) => Promise<AdminState>;

const initialState: AdminState = { status: "idle" };

/**
 * Formular-Hook für den Adminbereich (wie useEditorForm, aber mit den
 * Texten aus Admin.*). `resetOnSuccess` leert Formulare zum Anlegen.
 */
export function useAdminForm(action: AdminAction, options: { resetOnSuccess?: boolean } = {}) {
  const t = useTranslations("Admin");
  const [state, formAction, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const { resetOnSuccess = false } = options;

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") formRef.current?.reset();
  }, [state, resetOnSuccess]);

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

  const formError = state.status === "error" ? t(`errors.${state.code}`) : undefined;

  return { t, state, formAction, formRef, pending, onSubmit, fieldError, formError };
}
