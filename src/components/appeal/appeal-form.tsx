"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { FormAlert, TextAreaField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { APPEAL_MESSAGE_MAX } from "@/lib/appeals";
import { submitAppealAction, type AppealFormState } from "@/server/actions/appeals";

/** Widerspruch per Link aus der E-Mail; funktioniert ohne JavaScript. */
export function AppealForm({ token }: { token: string }) {
  const t = useTranslations("Appeal");
  const [state, formAction] = useActionState<AppealFormState, FormData>(submitAppealAction, { status: "idle" });

  if (state.status === "success") return <FormAlert tone="success">{t("received")}</FormAlert>;

  const error = state.status === "error" ? state : null;
  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      {error && error.code !== "validation" ? (
        <FormAlert tone="error">{t(`errors.${error.code}`, { max: APPEAL_MESSAGE_MAX })}</FormAlert>
      ) : null}
      <TextAreaField
        id="appeal-message"
        name="message"
        label={t("message")}
        hint={t("messageHint", { max: APPEAL_MESSAGE_MAX })}
        rows={6}
        required
        maxLength={APPEAL_MESSAGE_MAX}
        defaultValue={error?.values?.message}
        error={error?.fieldErrors?.message ? t("errors.validation", { max: APPEAL_MESSAGE_MAX }) : undefined}
      />
      <SubmitButton pendingLabel={t("submitting")} className="w-full">
        {t("submit")}
      </SubmitButton>
    </form>
  );
}
