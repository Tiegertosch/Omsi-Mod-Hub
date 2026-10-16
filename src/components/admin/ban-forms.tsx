"use client";

import { FormAlert, SelectField, TextField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import { ADMIN_LIMITS } from "@/lib/admin-forms";
import { BAN_DURATIONS, type BanDuration } from "@/lib/moderation";
import { banUserAction, unbanUserAction } from "@/server/actions/users";

import { useAdminForm } from "./use-admin-form";

export function BanForm({ userId, username }: { userId: string; username: string }) {
  const { t, formAction, onSubmit, pending, formError, fieldError } = useAdminForm(banUserAction);
  return (
    <details className="rounded-lg border border-border bg-surface-2">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted hover:text-fg">
        {t("users.ban")}
      </summary>
      <form action={formAction} onSubmit={onSubmit} className="space-y-3 border-t border-border p-3" noValidate>
        <input type="hidden" name="userId" value={userId} />
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        <TextField
          id={`ban-reason-${userId}`}
          name="reason"
          label={t("users.banReason")}
          hint={t("users.banReasonHint")}
          maxLength={ADMIN_LIMITS.banReason}
          error={fieldError("reason")}
        />
        <SelectField
          id={`ban-duration-${userId}`}
          name="duration"
          label={t("users.banDuration")}
          defaultValue="7d"
          error={fieldError("duration")}
        >
          {(Object.keys(BAN_DURATIONS) as BanDuration[]).map((duration) => (
            <option key={duration} value={duration}>
              {t(`users.durations.${duration}`)}
            </option>
          ))}
        </SelectField>
        <label className="flex items-start gap-2 text-sm text-fg">
          <input type="checkbox" name="hideProjects" className="mt-0.5 size-4 accent-[var(--color-accent)]" />
          <span>{t("users.hideProjects")}</span>
        </label>
        <PendingButton pending={pending} pendingLabel={t("saving")} variant="danger" size="sm">
          {t("users.banConfirm", { username })}
        </PendingButton>
      </form>
    </details>
  );
}

export function UnbanForm({ userId }: { userId: string }) {
  const { t, formAction, onSubmit, pending, formError } = useAdminForm(unbanUserAction);
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <PendingButton pending={pending} pendingLabel={t("saving")} variant="secondary" size="sm">
        {t("users.unban")}
      </PendingButton>
    </form>
  );
}
