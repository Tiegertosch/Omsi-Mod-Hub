"use client";

import { useLocale } from "next-intl";
import { useActionState } from "react";

import { FormAlert, TextField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import { idleState } from "@/lib/form-state";
import { loginAction } from "@/server/actions/auth";

import { useFormMessages } from "./use-form-messages";

export function LoginForm({ next }: { next: string }) {
  const locale = useLocale();
  const [state, formAction] = useActionState(loginAction, idleState);
  const { t, fieldError, formError, value } = useFormMessages(state);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

      <TextField
        id="login-identifier"
        name="identifier"
        label={t("identifier")}
        autoComplete="username"
        required
        maxLength={254}
        defaultValue={value("identifier")}
        error={fieldError("identifier")}
      />
      <div>
        <TextField
          id="login-password"
          name="password"
          type="password"
          label={t("password")}
          autoComplete="current-password"
          required
          maxLength={128}
          error={fieldError("password")}
        />
        <Link href="/forgot-password" className="mt-2 inline-block text-sm text-accent hover:text-accent-hover">
          {t("forgotLink")}
        </Link>
      </div>

      <SubmitButton pendingLabel={t("submitting")} className="w-full">
        {t("submitLogin")}
      </SubmitButton>

      <p className="text-center text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-medium text-accent hover:text-accent-hover">
          {t("registerLink")}
        </Link>
      </p>
    </form>
  );
}
