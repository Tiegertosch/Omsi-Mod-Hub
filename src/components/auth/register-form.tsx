"use client";

import { useLocale } from "next-intl";
import { useActionState } from "react";

import { FormAlert, TextField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import { PASSWORD_MAX, PASSWORD_MIN, USERNAME_MAX } from "@/lib/auth-rules";
import { idleState } from "@/lib/form-state";
import { registerAction } from "@/server/actions/auth";

import { useFormMessages } from "./use-form-messages";

export function RegisterForm() {
  const locale = useLocale();
  const [state, formAction] = useActionState(registerAction, idleState);
  const { t, fieldError, formError, value } = useFormMessages(state);

  const termsError = fieldError("acceptTerms");

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {/* Honeypot gegen Spam-Bots – für Menschen unsichtbar */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

      <TextField
        id="register-username"
        name="username"
        label={t("username")}
        autoComplete="username"
        required
        maxLength={USERNAME_MAX}
        spellCheck={false}
        defaultValue={value("username")}
        hint={t("usernameHint")}
        error={fieldError("username")}
      />
      <TextField
        id="register-email"
        name="email"
        type="email"
        label={t("email")}
        autoComplete="email"
        required
        maxLength={254}
        defaultValue={value("email")}
        error={fieldError("email")}
      />
      <TextField
        id="register-password"
        name="password"
        type="password"
        label={t("password")}
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        hint={t("passwordHint", { min: PASSWORD_MIN })}
        error={fieldError("password")}
      />
      <TextField
        id="register-password-confirm"
        name="passwordConfirm"
        type="password"
        label={t("passwordConfirm")}
        autoComplete="new-password"
        required
        maxLength={PASSWORD_MAX}
        error={fieldError("passwordConfirm")}
      />

      <div>
        <label className="flex items-start gap-2.5 text-sm text-muted">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            aria-invalid={termsError ? true : undefined}
            aria-describedby={termsError ? "register-terms-error" : undefined}
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
          />
          <span>
            {t.rich("acceptTerms", {
              terms: (chunks) => (
                <Link href="/legal/terms" target="_blank" className="text-accent hover:text-accent-hover">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/legal/privacy" target="_blank" className="text-accent hover:text-accent-hover">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {termsError ? (
          <p id="register-terms-error" className="mt-1.5 text-xs text-danger">
            {termsError}
          </p>
        ) : null}
      </div>

      <SubmitButton pendingLabel={t("submitting")} className="w-full">
        {t("submitRegister")}
      </SubmitButton>

      <p className="text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          {t("loginLink")}
        </Link>
      </p>
    </form>
  );
}
