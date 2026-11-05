"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { CodeInput } from "@/components/auth/code-input";
import { useFormMessages } from "@/components/auth/use-form-messages";
import { FormAlert, TextField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import { PASSWORD_MAX } from "@/lib/auth-rules";
import { idleState, type FormState } from "@/lib/form-state";
import type { QrPath } from "@/lib/qr";
import { TOTP_DIGITS, TWO_FACTOR_BACKUP_CODES } from "@/lib/two-factor";
import {
  confirmTwoFactorSetupAction,
  disableTwoFactorAction,
  regenerateBackupCodesAction,
  startTwoFactorSetupAction,
  type BackupCodesState,
  type TwoFactorSetupState,
} from "@/server/actions/two-factor";

/** Nur Fehler- und Erfolgszustände gehen an useFormMessages. */
const asForm = (state: TwoFactorSetupState | BackupCodesState): FormState =>
  state.status === "setup" || state.status === "codes" ? idleState : state;

function QrCode({ qr, label }: { qr: QrPath; label: string }) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      shapeRendering="crispEdges"
      className="size-48 rounded-lg bg-white"
    >
      <path d={qr.path} fill="#000" />
    </svg>
  );
}

function BackupCodeList({ codes }: { codes: string[] }) {
  const t = useTranslations("Account");
  return (
    <div className="space-y-2">
      <ul
        aria-label={t("twoFactor.backupCodesLabel")}
        className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-border bg-surface-2 p-4 font-mono text-sm text-fg sm:max-w-sm"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <p className="text-xs text-subtle">{t("twoFactor.backupCodesHint")}</p>
    </div>
  );
}

function PasswordField({ id, error }: { id: string; error?: string }) {
  const t = useTranslations("Account");
  return (
    <TextField
      id={id}
      name="password"
      type="password"
      label={t("currentPassword")}
      autoComplete="current-password"
      required
      maxLength={PASSWORD_MAX}
      className="max-w-sm"
      error={error}
    />
  );
}

function SetupFlow() {
  const t = useTranslations("Account");
  const [setup, startAction, starting] = useActionState(startTwoFactorSetupAction, idleState as TwoFactorSetupState);
  const [confirm, confirmAction, confirming] = useActionState(confirmTwoFactorSetupAction, idleState);
  const start = useFormMessages(asForm(setup));
  const done = useFormMessages(confirm);

  if (setup.status !== "setup") {
    return (
      <form action={startAction} className="space-y-4" noValidate>
        {start.formError ? <FormAlert tone="error">{start.formError}</FormAlert> : null}
        <PasswordField id="two-factor-setup-password" error={start.fieldError("password")} />
        <PendingButton pending={starting} pendingLabel={start.t("submitting")}>
          {t("twoFactor.start")}
        </PendingButton>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="list-decimal space-y-6 pl-5 text-sm text-fg marker:text-subtle">
        <li className="space-y-3">
          <p>{t("twoFactor.stepScan")}</p>
          <QrCode qr={setup.qr} label={t("twoFactor.qrLabel")} />
          <p className="text-muted">
            {t("twoFactor.manualEntry")}{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-fg" data-testid="totp-secret">
              {setup.secret}
            </code>
          </p>
          {/* Auf dem Smartphone selbst lässt sich der Link direkt in der App öffnen. */}
          <a href={setup.uri} className="inline-block text-accent hover:text-accent-hover sm:hidden">
            {t("twoFactor.openInApp")}
          </a>
        </li>
        <li className="space-y-3">
          <p>{t("twoFactor.stepBackup", { count: TWO_FACTOR_BACKUP_CODES })}</p>
          <BackupCodeList codes={setup.backupCodes} />
        </li>
        <li className="space-y-3">
          <p>{t("twoFactor.stepConfirm")}</p>
          <form action={confirmAction} className="space-y-4" noValidate>
            {done.formError && confirm.status === "error" && confirm.code !== "validation" ? (
              <FormAlert tone="error">{done.formError}</FormAlert>
            ) : null}
            <div className="max-w-sm">
              <CodeInput
                id="two-factor-setup-code"
                length={TOTP_DIGITS}
                label={t("twoFactor.codeLabel")}
                error={done.fieldError("code")}
                autoFocus={false}
              />
            </div>
            <PendingButton pending={confirming} pendingLabel={done.t("submitting")}>
              {t("twoFactor.confirm")}
            </PendingButton>
          </form>
        </li>
      </ol>
    </div>
  );
}

function RegenerateCodes() {
  const t = useTranslations("Account");
  const [state, formAction, pending] = useActionState(regenerateBackupCodesAction, idleState as BackupCodesState);
  const { fieldError, formError, t: authT } = useFormMessages(asForm(state));

  if (state.status === "codes") {
    return (
      <div className="space-y-3">
        <FormAlert tone="success">{t("twoFactor.newCodes")}</FormAlert>
        <BackupCodeList codes={state.backupCodes} />
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <PasswordField id="two-factor-codes-password" error={fieldError("password")} />
      <PendingButton pending={pending} pendingLabel={authT("submitting")} variant="secondary" size="sm">
        {t("twoFactor.regenerate")}
      </PendingButton>
    </form>
  );
}

function DisableForm({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("Account");
  const [state, formAction, pending] = useActionState(disableTwoFactorAction, idleState);
  const { fieldError, formError, t: authT } = useFormMessages(state);
  const [method, setMethod] = useState<"totp" | "backup">("totp");

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {isAdmin ? <p className="text-sm text-warning">{t("twoFactor.disableAdminWarning")}</p> : null}
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <PasswordField id="two-factor-disable-password" error={fieldError("password")} />
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium text-fg">{t("twoFactor.disableMethod")}</legend>
        {(["totp", "backup"] as const).map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm text-fg">
            <input
              type="radio"
              name="method"
              value={value}
              checked={method === value}
              onChange={() => setMethod(value)}
            />
            {value === "totp" ? t("twoFactor.methodApp") : t("twoFactor.methodBackup")}
          </label>
        ))}
      </fieldset>
      {method === "backup" ? (
        <TextField
          id="two-factor-disable-code"
          name="code"
          label={t("twoFactor.backupLabel")}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={13}
          required
          className="max-w-xs"
          error={fieldError("code")}
        />
      ) : (
        <div className="max-w-sm">
          <CodeInput
            id="two-factor-disable-code"
            length={TOTP_DIGITS}
            label={t("twoFactor.codeLabel")}
            error={fieldError("code")}
            autoFocus={false}
          />
        </div>
      )}
      <PendingButton pending={pending} pendingLabel={authT("submitting")} variant="danger" size="sm">
        {t("twoFactor.disable")}
      </PendingButton>
    </form>
  );
}

export function TwoFactorSettings({
  enabled,
  backupCodesLeft,
  isAdmin,
}: {
  enabled: boolean;
  backupCodesLeft: number;
  isAdmin: boolean;
}) {
  const t = useTranslations("Account");

  if (!enabled) return <SetupFlow />;

  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
        <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
        <div className="text-sm">
          <p className="font-medium text-fg">{t("twoFactor.active")}</p>
          <p className="mt-0.5 text-muted">{t("twoFactor.backupCodesLeft", { count: backupCodesLeft })}</p>
        </div>
      </div>
      <details className="rounded-lg border border-border bg-surface-2">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-fg">{t("twoFactor.regenerateOpen")}</summary>
        <div className="border-t border-border p-4">
          <RegenerateCodes />
        </div>
      </details>
      <details className="rounded-lg border border-danger/40 bg-surface-2">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-danger hover:text-fg">
          {t("twoFactor.disableOpen")}
        </summary>
        <div className="border-t border-danger/40 p-4">
          <DisableForm isAdmin={isAdmin} />
        </div>
      </details>
    </div>
  );
}
