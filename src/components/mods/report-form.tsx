"use client";

import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { reportProject, type ReportFormState } from "@/server/actions/report-project";

const REASONS = [
  "BROKEN_LINK",
  "WRONG_INFORMATION",
  "MALWARE",
  "COPYRIGHT",
  "INAPPROPRIATE",
  "SPAM",
  "OTHER",
] as const;

const ERROR_KEYS = {
  validation: "errorValidation",
  rate_limit: "errorRateLimit",
  not_found: "errorNotFound",
  generic: "errorGeneric",
} as const;

export function ReportForm({ projectId }: { projectId: string }) {
  const t = useTranslations("Report");
  const [state, formAction, pending] = useActionState<ReportFormState, FormData>(reportProject, {
    status: "idle",
  });

  return (
    <details className="group rounded-[var(--radius-card)] border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        <Flag aria-hidden className="size-4" />
        {t("title")}
      </summary>

      <div className="border-t border-border px-4 pt-3 pb-4">
        {state.status === "success" ? (
          <p role="status" className="text-sm text-success">
            {t("success")}
          </p>
        ) : (
          <form action={formAction} className="space-y-4">
            <p className="text-sm text-muted">{t("intro")}</p>
            <input type="hidden" name="projectId" value={projectId} />

            {/* Honeypot gegen Spam-Bots – für Menschen unsichtbar */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
              </label>
            </div>

            <div>
              <label htmlFor="report-reason" className="mb-1.5 block text-sm font-medium text-fg">
                {t("reason")}
              </label>
              <select
                id="report-reason"
                name="reason"
                required
                defaultValue=""
                className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg focus:border-accent focus:outline-none"
              >
                <option value="" disabled>
                  —
                </option>
                {REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {t(`reasons.${reason}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="report-description" className="mb-1.5 block text-sm font-medium text-fg">
                {t("description")}
              </label>
              <textarea
                id="report-description"
                name="description"
                rows={4}
                maxLength={2000}
                aria-describedby="report-description-hint"
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
              />
              <p id="report-description-hint" className="mt-1 text-xs text-subtle">
                {t("descriptionHint")}
              </p>
            </div>

            {state.status === "error" ? (
              <p role="alert" className="text-sm text-danger">
                {t(ERROR_KEYS[state.code])}
              </p>
            ) : null}

            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? t("submitting") : t("submit")}
            </Button>
          </form>
        )}
      </div>
    </details>
  );
}
