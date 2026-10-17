"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";

import { useFormMessages } from "@/components/auth/use-form-messages";
import { FormAlert, inputClass, TextField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { localeLabels, routing } from "@/i18n/routing";
import { DISPLAY_NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth-rules";
import { idleState } from "@/lib/form-state";
import { changeEmailAction, changePasswordAction, updateProfileAction } from "@/server/actions/account";

export function ProfileForm({
  name,
  username,
  preferredLocale,
}: {
  name: string;
  username: string;
  preferredLocale: string | null;
}) {
  const locale = useLocale();
  const t = useTranslations("Account");
  const [state, formAction] = useActionState(updateProfileAction, idleState);
  const { fieldError, formError, value, t: authT } = useFormMessages(state);
  const localeError = fieldError("preferredLocale");

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      {state.status === "success" ? <FormAlert tone="success">{t("profileSaved")}</FormAlert> : null}

      <TextField
        id="settings-username"
        label={t("username")}
        value={username}
        readOnly
        disabled
        hint={t("usernameFixed")}
      />
      <TextField
        id="settings-name"
        name="name"
        label={t("displayName")}
        autoComplete="nickname"
        required
        maxLength={DISPLAY_NAME_MAX}
        defaultValue={value("name") ?? name}
        error={fieldError("name")}
      />
      <div>
        <label htmlFor="settings-locale" className="mb-1.5 block text-sm font-medium text-fg">
          {t("preferredLocale")}
        </label>
        <select
          id="settings-locale"
          name="preferredLocale"
          defaultValue={value("preferredLocale") ?? preferredLocale ?? locale}
          aria-invalid={localeError ? true : undefined}
          aria-describedby="settings-locale-hint"
          className={inputClass}
        >
          {routing.locales.map((l) => (
            <option key={l} value={l}>
              {localeLabels[l]}
            </option>
          ))}
        </select>
        {localeError ? <p className="mt-1.5 text-xs text-danger">{localeError}</p> : null}
        <p id="settings-locale-hint" className="mt-1.5 text-xs text-subtle">
          {t("preferredLocaleHint")}
        </p>
      </div>
      <SubmitButton pendingLabel={authT("submitting")} variant="secondary">
        {t("saveProfile")}
      </SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const t = useTranslations("Account");
  const [state, formAction] = useActionState(changePasswordAction, idleState);
  const { fieldError, formError, t: authT } = useFormMessages(state);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      {state.status === "success" ? <FormAlert tone="success">{t("passwordChanged")}</FormAlert> : null}

      <TextField
        id="settings-current-password"
        name="currentPassword"
        type="password"
        label={t("currentPassword")}
        autoComplete="current-password"
        required
        maxLength={PASSWORD_MAX}
        error={fieldError("currentPassword")}
      />
      <TextField
        id="settings-new-password"
        name="newPassword"
        type="password"
        label={t("newPassword")}
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        hint={authT("passwordHint", { min: PASSWORD_MIN })}
        error={fieldError("newPassword")}
      />
      <TextField
        id="settings-new-password-confirm"
        name="newPasswordConfirm"
        type="password"
        label={t("newPasswordConfirm")}
        autoComplete="new-password"
        required
        maxLength={PASSWORD_MAX}
        error={fieldError("newPasswordConfirm")}
      />
      <label className="flex items-center gap-2.5 text-sm text-muted">
        <input
          type="checkbox"
          name="revokeOtherSessions"
          defaultChecked
          className="size-4 accent-[var(--color-accent)]"
        />
        {t("revokeOthers")}
      </label>
      <SubmitButton pendingLabel={authT("submitting")} variant="secondary">
        {t("savePassword")}
      </SubmitButton>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const locale = useLocale();
  const t = useTranslations("Account");
  const [state, formAction] = useActionState(changeEmailAction, idleState);
  const { fieldError, formError, value, t: authT } = useFormMessages(state);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      {state.status === "success" ? (
        <FormAlert tone="success">{t("emailChangeSent", { email: state.message ?? email })}</FormAlert>
      ) : null}

      <TextField id="settings-current-email" label={t("currentEmail")} value={email} readOnly disabled />
      <TextField
        id="settings-new-email"
        name="newEmail"
        type="email"
        label={t("newEmail")}
        autoComplete="email"
        required
        maxLength={254}
        defaultValue={value("newEmail")}
        hint={t("emailChangeHint")}
        error={fieldError("newEmail")}
      />
      <TextField
        id="settings-email-password"
        name="currentPassword"
        type="password"
        label={t("currentPassword")}
        autoComplete="current-password"
        required
        maxLength={PASSWORD_MAX}
        error={fieldError("currentPassword")}
      />
      <SubmitButton pendingLabel={authT("submitting")} variant="secondary">
        {t("saveEmail")}
      </SubmitButton>
    </form>
  );
}
