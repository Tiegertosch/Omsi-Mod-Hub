"use client";

import { useLocale } from "next-intl";
import { useActionState } from "react";

import { FormAlert, TextField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth-rules";
import { idleState } from "@/lib/form-state";
import { requestPasswordResetAction, resetPasswordAction } from "@/server/actions/auth";

import { useFormMessages } from "./use-form-messages";

export function ForgotPasswordForm() {
  const locale = useLocale();
  const [state, formAction] = useActionState(requestPasswordResetAction, idleState);
  const { t, fieldError, formError, value } = useFormMessages(state);

  if (state.status === "success") {
    return (
      <div className="space-y-6">
        <FormAlert tone="success">{t("forgotSent")}</FormAlert>
        <Link href="/login" className="inline-block text-sm font-medium text-accent hover:text-accent-hover">
          {t("loginLink")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <TextField
        id="forgot-email"
        name="email"
        type="email"
        label={t("email")}
        autoComplete="email"
        required
        maxLength={254}
        defaultValue={value("email")}
        error={fieldError("email")}
      />
      <SubmitButton pendingLabel={t("submitting")} className="w-full">
        {t("submitForgot")}
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          {t("loginLink")}
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, idleState);
  const { t, fieldError, formError } = useFormMessages(state);

  if (state.status === "success") {
    return (
      <div className="space-y-6">
        <FormAlert tone="success">{t("resetDone")}</FormAlert>
        <Link href="/login" className="inline-block text-sm font-medium text-accent hover:text-accent-hover">
          {t("loginLink")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      {formError ? (
        <FormAlert tone="error">
          {formError}
          {state.status === "error" && state.code === "token_invalid" ? (
            <>
              {" "}
              <Link href="/forgot-password" className="font-medium text-accent hover:text-accent-hover">
                {t("forgotTitle")}
              </Link>
            </>
          ) : null}
        </FormAlert>
      ) : null}
      <TextField
        id="reset-password"
        name="password"
        type="password"
        label={t("newPassword")}
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        hint={t("passwordHint", { min: PASSWORD_MIN })}
        error={fieldError("password")}
      />
      <TextField
        id="reset-password-confirm"
        name="passwordConfirm"
        type="password"
        label={t("passwordConfirm")}
        autoComplete="new-password"
        required
        maxLength={PASSWORD_MAX}
        error={fieldError("passwordConfirm")}
      />
      <SubmitButton pendingLabel={t("submitting")} className="w-full">
        {t("submitReset")}
      </SubmitButton>
    </form>
  );
}
