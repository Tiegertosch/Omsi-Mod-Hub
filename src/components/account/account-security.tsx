"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";

import { useFormMessages } from "@/components/auth/use-form-messages";
import { FormAlert, TextField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import { PASSWORD_MAX } from "@/lib/auth-rules";
import { idleState } from "@/lib/form-state";
import { deleteAccountAction, revokeOtherSessionsAction, revokeSessionAction } from "@/server/actions/account";

export function RevokeSessionForm({ sessionId, label }: { sessionId: string; label: string }) {
  const t = useTranslations("Account");
  const [state, formAction, pending] = useActionState(revokeSessionAction, idleState);
  const { formError, t: authT } = useFormMessages(state);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="sessionId" value={sessionId} />
      <PendingButton
        pending={pending}
        pendingLabel={authT("submitting")}
        variant="secondary"
        size="sm"
        aria-label={t("revokeSessionFor", { device: label })}
      >
        {t("revokeSession")}
      </PendingButton>
      {formError ? (
        <p role="alert" className="text-xs text-danger">
          {formError}
        </p>
      ) : null}
    </form>
  );
}

export function RevokeOtherSessionsForm() {
  const t = useTranslations("Account");
  const [state, formAction, pending] = useActionState(revokeOtherSessionsAction, idleState);
  const { formError, t: authT } = useFormMessages(state);

  return (
    <form action={formAction} className="space-y-3">
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      {state.status === "success" ? <FormAlert tone="success">{t("otherSessionsRevoked")}</FormAlert> : null}
      <PendingButton pending={pending} pendingLabel={authT("submitting")} variant="outline" size="sm">
        {t("revokeOtherSessions")}
      </PendingButton>
    </form>
  );
}

export function DeleteAccountForm({ username }: { username: string }) {
  const locale = useLocale();
  const t = useTranslations("Account");
  const [state, formAction, pending] = useActionState(deleteAccountAction, idleState);
  const { fieldError, formError, t: authT } = useFormMessages(state);

  return (
    <details className="rounded-lg border border-danger/40 bg-surface-2" open={state.status === "error" ? true : undefined}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-danger hover:text-fg">
        {t("deleteOpen")}
      </summary>
      <form action={formAction} className="space-y-5 border-t border-danger/40 p-4" noValidate>
        <input type="hidden" name="locale" value={locale} />
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        <TextField
          id="delete-password"
          name="password"
          type="password"
          label={t("currentPassword")}
          autoComplete="current-password"
          required
          maxLength={PASSWORD_MAX}
          error={fieldError("password")}
        />
        <TextField
          id="delete-confirm-username"
          name="confirmUsername"
          label={t("deleteConfirmLabel", { username })}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={64}
          error={fieldError("confirmUsername")}
        />
        <PendingButton pending={pending} pendingLabel={authT("submitting")} variant="danger">
          {t("deleteSubmit")}
        </PendingButton>
      </form>
    </details>
  );
}
