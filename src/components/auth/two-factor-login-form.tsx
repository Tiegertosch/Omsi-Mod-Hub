"use client";

import { useLocale } from "next-intl";
import { useActionState } from "react";

import { FormAlert, TextField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import { idleState } from "@/lib/form-state";
import { verifyTwoFactorLoginAction } from "@/server/actions/two-factor";

import { useFormMessages } from "./use-form-messages";

/**
 * Anmeldung, Schritt 2: Code aus der Authenticator-App oder ein Backup-Code.
 * Der Wechsel zwischen beiden ist ein Link (?method=backup), damit er auch
 * ohne JavaScript funktioniert.
 */
export function TwoFactorLoginForm({ next, method }: { next: string; method: "totp" | "backup" }) {
  const locale = useLocale();
  const [state, formAction] = useActionState(verifyTwoFactorLoginAction, idleState);
  const { t, fieldError, formError } = useFormMessages(state);
  const expired = state.status === "error" && state.code === "two_factor_expired";
  const query = (m: "totp" | "backup") => {
    const params = new URLSearchParams();
    if (m === "backup") params.set("method", "backup");
    if (next) params.set("next", next);
    const search = params.toString();
    return `/login/two-factor${search ? `?${search}` : ""}`;
  };

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="method" value={method} />
      {formError ? (
        <FormAlert tone="error">
          {formError}
          {expired ? (
            <>
              {" "}
              <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-accent">
                {t("twoFactor.backToLogin")}
              </Link>
            </>
          ) : null}
        </FormAlert>
      ) : null}

      <TextField
        id="two-factor-code"
        name="code"
        label={method === "backup" ? t("twoFactor.backupLabel") : t("twoFactor.codeLabel")}
        hint={method === "backup" ? t("twoFactor.backupHint") : t("twoFactor.codeHint")}
        autoComplete="one-time-code"
        inputMode={method === "backup" ? "text" : "numeric"}
        autoCapitalize="none"
        spellCheck={false}
        maxLength={method === "backup" ? 13 : 8}
        required
        autoFocus
        error={fieldError("code")}
      />

      <SubmitButton pendingLabel={t("submitting")} className="w-full">
        {t("twoFactor.submit")}
      </SubmitButton>

      <p className="text-center text-sm">
        <Link href={query(method === "backup" ? "totp" : "backup")} className="text-accent hover:text-accent-hover">
          {method === "backup" ? t("twoFactor.useApp") : t("twoFactor.useBackup")}
        </Link>
      </p>
    </form>
  );
}
