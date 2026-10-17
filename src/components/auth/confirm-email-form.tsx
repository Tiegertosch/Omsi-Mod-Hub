"use client";

import { useLocale } from "next-intl";
import { useActionState } from "react";

import { FormAlert, TextField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { VERIFICATION_CODE_LENGTH, VERIFICATION_CODE_MINUTES } from "@/lib/auth-rules";
import { idleState } from "@/lib/form-state";
import { resendVerificationCodeAction, verifyEmailCodeAction } from "@/server/actions/auth";

import { useFormMessages } from "./use-form-messages";

/**
 * Code-Eingabe nach der Registrierung. „Code erneut senden“ schickt dasselbe
 * Formular an eine zweite Action (formAction), damit die eingetragene Adresse
 * mitkommt – funktioniert auch ohne JavaScript.
 */
export function ConfirmEmailForm({ email, next }: { email: string; next: string }) {
  const locale = useLocale();
  const [state, verifyAction] = useActionState(verifyEmailCodeAction, idleState);
  const [resendState, resendAction, resendPending] = useActionState(resendVerificationCodeAction, idleState);
  const { t, fieldError, formError, value } = useFormMessages(state);
  const resend = useFormMessages(resendState);

  return (
    <form action={verifyAction} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      {resend.formError ? <FormAlert tone="error">{resend.formError}</FormAlert> : null}
      {resendState.status === "success" ? (
        <FormAlert tone="success">{t("codeResent", { email: resendState.message ?? "" })}</FormAlert>
      ) : null}

      <TextField
        id="confirm-email"
        name="email"
        type="email"
        label={t("email")}
        autoComplete="email"
        required
        maxLength={254}
        defaultValue={value("email") ?? resend.value("email") ?? email}
        error={fieldError("email") ?? resend.fieldError("email")}
      />
      <TextField
        id="confirm-code"
        name="code"
        label={t("code")}
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        // Platz für ein Leerzeichen in der Mitte („123 456“)
        maxLength={VERIFICATION_CODE_LENGTH + 1}
        spellCheck={false}
        hint={t("codeHint", { minutes: VERIFICATION_CODE_MINUTES })}
        error={fieldError("code")}
      />
      <SubmitButton pendingLabel={t("submitting")} className="w-full">
        {t("submitCode")}
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        {t("noCode")}{" "}
        <button
          type="submit"
          formAction={resendAction}
          formNoValidate
          disabled={resendPending}
          className="font-medium text-accent hover:text-accent-hover disabled:opacity-50"
        >
          {resendPending ? t("submitting") : t("resendCode")}
        </button>
      </p>
    </form>
  );
}
