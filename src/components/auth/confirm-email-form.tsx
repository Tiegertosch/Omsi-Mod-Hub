"use client";

import { useLocale } from "next-intl";
import { useActionState } from "react";

import { AutoDismissAlert } from "@/components/ui/auto-dismiss-alert";
import { TextField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import { useNow } from "@/components/ui/use-now";
import { RESEND_COOLDOWN_MINUTES, VERIFICATION_CODE_LENGTH, VERIFICATION_CODE_MINUTES } from "@/lib/auth-rules";
import { idleState } from "@/lib/form-state";
import { resendVerificationCodeAction, verifyEmailCodeAction } from "@/server/actions/auth";

import { CodeInput } from "./code-input";
import { useFormMessages } from "./use-form-messages";

/**
 * Schritt 2 der Registrierung. Ist die Adresse bekannt (Cookie), steht sie als
 * Text da; sonst (z. B. anderes Gerät) wird sie eingegeben. „Code erneut
 * senden“ schickt dasselbe Formular an eine zweite Action (formAction), damit
 * die Adresse mitkommt – funktioniert auch ohne JavaScript.
 */
/** Restzeit als m:ss, aufgerundet auf volle Sekunden. */
function formatCountdown(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ConfirmEmailForm({
  email,
  next,
  resendRetryAt,
  renderedAt,
}: {
  email: string | null;
  next: string;
  /** Sperre für „Code erneut senden“ beim Laden der Seite (Unix-ms), sonst null */
  resendRetryAt: number | null;
  /** Zeitpunkt des Server-Renderings, bis die Seite hydriert ist */
  renderedAt: number;
}) {
  const locale = useLocale();
  const [state, verifyAction] = useActionState(verifyEmailCodeAction, idleState);
  const [resendState, resendAction, resendPending] = useActionState(resendVerificationCodeAction, idleState);
  const { t, fieldError, formError, value } = useFormMessages(state);
  const resend = useFormMessages(resendState);

  // Nach einem neuen Code ist „Code erneut senden“ gesperrt; der Server liefert das Ende der Sperre mit.
  const retryAt = (resendState.status !== "idle" ? resendState.retryAt : undefined) ?? resendRetryAt;
  const now = useNow(retryAt !== null) ?? renderedAt;
  const cooldownMs = retryAt ? Math.min(RESEND_COOLDOWN_MINUTES * 60 * 1000, Math.max(0, retryAt - now)) : 0;

  return (
    <form action={verifyAction} className="space-y-6" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      {/* Hinweise blenden sich nach 5 Sekunden aus; ein neues Ergebnis zeigt sie wieder. */}
      {formError ? (
        <AutoDismissAlert tone="error" resetKey={state}>
          {formError}
        </AutoDismissAlert>
      ) : null}
      {resend.formError ? (
        <AutoDismissAlert tone="error" resetKey={resendState}>
          {resend.formError}
        </AutoDismissAlert>
      ) : null}
      {resendState.status === "success" ? (
        <AutoDismissAlert tone="success" resetKey={resendState}>
          {t("codeResent", { email: resendState.message ?? "" })}
        </AutoDismissAlert>
      ) : null}

      {email ? (
        <div>
          <input type="hidden" name="email" value={email} />
          <p className="text-sm text-muted">{t("codeSentTo", { length: VERIFICATION_CODE_LENGTH })}</p>
          <p className="mt-1 font-medium break-all text-fg">
            {email}
          </p>
          <Link href="/register?edit=1" className="mt-1.5 inline-block text-sm font-medium text-accent hover:text-accent-hover">
            {t("editEmail")}
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-muted">{t("codeSentGeneric", { length: VERIFICATION_CODE_LENGTH })}</p>
          <TextField
            id="confirm-email"
            name="email"
            type="email"
            label={t("email")}
            autoComplete="email"
            required
            maxLength={254}
            defaultValue={value("email") ?? resend.value("email")}
            error={fieldError("email") ?? resend.fieldError("email")}
          />
        </div>
      )}

      <div>
        <CodeInput id="confirm-code" length={VERIFICATION_CODE_LENGTH} label={t("code")} error={fieldError("code")} />
        <p className="mt-2 text-xs text-subtle">{t("codeHint", { minutes: VERIFICATION_CODE_MINUTES })}</p>
      </div>

      <SubmitButton pendingLabel={t("submitting")} className="w-full">
        {t("submitCode")}
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        {t("noCode")}{" "}
        {cooldownMs > 0 ? (
          <span className="font-medium whitespace-nowrap text-subtle tabular-nums">
            {t("resendAvailableIn", { time: formatCountdown(cooldownMs) })}
          </span>
        ) : (
          <button
            type="submit"
            formAction={resendAction}
            formNoValidate
            disabled={resendPending}
            className="font-medium text-accent hover:text-accent-hover disabled:opacity-50"
          >
            {resendPending ? t("submitting") : t("resendCode")}
          </button>
        )}
      </p>
    </form>
  );
}
