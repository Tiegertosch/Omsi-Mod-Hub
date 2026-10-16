"use client";

import { useTranslations } from "next-intl";

import { DISPLAY_NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth-rules";
import type { FormState } from "@/lib/form-state";

/** Übersetzt Fehlercodes einer Server Action und liefert zuvor eingegebene Werte. */
export function useFormMessages(state: FormState) {
  const t = useTranslations("Auth");

  const fieldError = (name: string) => {
    if (state.status !== "error") return undefined;
    const code = state.fieldErrors?.[name];
    if (!code) return undefined;
    return t(`fieldErrors.${code}`, { min: PASSWORD_MIN, max: code === "name" ? DISPLAY_NAME_MAX : PASSWORD_MAX });
  };

  const formError = state.status === "error" ? t(`errors.${state.code}`) : undefined;
  const value = (name: string) => (state.status === "error" ? state.values?.[name] : undefined);

  return { t, fieldError, formError, value };
}
