"use client";

import { ExternalLink, FileText, TriangleAlert } from "lucide-react";
import { useLocale } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";

import { buttonStyles } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import { Link, usePathname } from "@/i18n/navigation";
import { PASSWORD_MAX } from "@/lib/auth-rules";
import { idleState, type FormState } from "@/lib/form-state";
import { acceptTermsAction, declineTermsAction } from "@/server/actions/terms";

export type TermsConsentLabels = {
  title: string;
  intro: string;
  changesTitle: string;
  readFull: string;
  opensInNewTab: string;
  accept: string;
  decline: string;
  declineTitle: string;
  declineIntro: string;
  declineItems: string[];
  declineKeep: string;
  adminNote: string;
  password: string;
  declineSubmit: string;
  back: string;
  submitting: string;
  /** Fehlertexte nach Code (Auth.errors bzw. Auth.fieldErrors) */
  errors: Record<string, string>;
};

const errorText = (state: FormState, errors: Record<string, string>) =>
  state.status === "error" ? (errors[state.code] ?? errors.generic) : null;

/**
 * Popup bei neuer Fassung der Nutzungsbedingungen. Modal (<dialog>), lässt
 * sich nicht per Escape schließen – nur über „akzeptieren“ oder „Konto
 * schließen“. Auf den Rechtsseiten bleibt es zu, damit die neue Fassung
 * gelesen werden kann. Nach dem Akzeptieren rendert der Server ohne Popup.
 */
export function TermsConsentDialog({
  labels,
  changes,
  canDelete,
  termsHref,
}: {
  labels: TermsConsentLabels;
  changes: readonly string[];
  canDelete: boolean;
  termsHref: string;
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<"notice" | "decline">("notice");
  const [acceptState, acceptAction, accepting] = useActionState(acceptTermsAction, idleState);
  const [declineState, declineAction, declining] = useActionState(declineTermsAction, idleState);
  const onLegalPage = pathname.startsWith("/legal/");

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (onLegalPage) {
      if (element.open) element.close();
    } else if (!element.open) {
      element.showModal();
    }
  }, [onLegalPage]);

  const acceptError = errorText(acceptState, labels.errors);
  const declineError = errorText(declineState, labels.errors);
  const passwordError =
    declineState.status === "error" && declineState.fieldErrors?.password
      ? labels.errors[`field.${declineState.fieldErrors.password}`]
      : undefined;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="terms-consent-title"
      onCancel={(event) => event.preventDefault()}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-border bg-surface p-6 text-fg shadow-card backdrop:bg-black/75 backdrop:backdrop-blur-sm sm:p-8"
    >
      {step === "notice" ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <FileText aria-hidden className="mt-1 size-6 shrink-0 text-accent" />
            <div>
              <h2 id="terms-consent-title" className="text-xl font-bold tracking-tight">
                {labels.title}
              </h2>
              <p className="mt-2 text-sm text-muted">{labels.intro}</p>
            </div>
          </div>
          <section aria-labelledby="terms-consent-changes" className="rounded-lg border border-border bg-surface-2 p-4">
            <h3 id="terms-consent-changes" className="text-sm font-semibold">
              {labels.changesTitle}
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-fg/85">
              {changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </section>
          <Link
            href={termsHref}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"
          >
            {labels.readFull}
            <ExternalLink aria-hidden className="size-3.5" />
            <span className="sr-only"> {labels.opensInNewTab}</span>
          </Link>
          {acceptError ? <FormAlert tone="error">{acceptError}</FormAlert> : null}
          <div className="flex flex-col gap-3 pt-1">
            <form action={acceptAction}>
              {/* Fokus beim Öffnen auf die Hauptaktion statt auf den ersten Link */}
              <PendingButton pending={accepting} pendingLabel={labels.submitting} size="lg" className="w-full" autoFocus>
                {labels.accept}
              </PendingButton>
            </form>
            <button
              type="button"
              onClick={() => setStep("decline")}
              className={buttonStyles({ variant: "ghost", className: "w-full text-danger hover:text-danger" })}
            >
              {labels.decline}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden className="mt-1 size-6 shrink-0 text-danger" />
            <div>
              <h2 id="terms-consent-title" className="text-xl font-bold tracking-tight">
                {labels.declineTitle}
              </h2>
              <p className="mt-2 text-sm text-muted">{labels.declineIntro}</p>
            </div>
          </div>
          <ul className="list-disc space-y-1.5 rounded-lg border border-danger/40 bg-danger/5 py-4 pr-4 pl-9 text-sm text-fg/90">
            {labels.declineItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-sm text-muted">{labels.declineKeep}</p>

          {canDelete ? (
            <form action={declineAction} className="space-y-4" noValidate>
              <input type="hidden" name="locale" value={locale} />
              {declineError ? <FormAlert tone="error">{declineError}</FormAlert> : null}
              <TextField
                id="terms-decline-password"
                name="password"
                type="password"
                label={labels.password}
                autoComplete="current-password"
                required
                maxLength={PASSWORD_MAX}
                error={passwordError}
              />
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button type="button" onClick={() => setStep("notice")} className={buttonStyles({ variant: "secondary" })}>
                  {labels.back}
                </button>
                <PendingButton pending={declining} pendingLabel={labels.submitting} variant="danger">
                  {labels.declineSubmit}
                </PendingButton>
              </div>
            </form>
          ) : (
            <>
              <p className="rounded-lg border border-border bg-surface-2 px-3.5 py-3 text-sm text-muted">{labels.adminNote}</p>
              <button type="button" onClick={() => setStep("notice")} className={buttonStyles({ variant: "secondary" })}>
                {labels.back}
              </button>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
