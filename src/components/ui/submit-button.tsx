"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { buttonStyles, type ButtonVariant } from "./button";
import type { useCaptcha } from "./captcha";

/** Absende-Button, der während der Verarbeitung deaktiviert ist. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className,
  captcha,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: ButtonVariant;
  className?: string;
  /** Ergebnis von useCaptcha: Der Klick löst zuerst die Prüfung aus (Anzeige „Wird geprüft …“). */
  captcha?: ReturnType<typeof useCaptcha>;
}) {
  const { pending } = useFormStatus();
  const solving = captcha?.solving === true;
  const disabled = pending || solving || captcha?.ready === false;
  const busyLabel = pending ? pendingLabel : solving ? captcha?.verifyingLabel : null;
  const button = (
    <button
      type="submit"
      disabled={disabled}
      aria-disabled={disabled}
      className={buttonStyles({ variant, size: "lg", className })}
      aria-busy={busyLabel ? true : undefined}
      onClick={captcha?.trigger.onClick}
    >
      {busyLabel ? (
        <>
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
  if (!captcha) return button;
  return (
    <div>
      {captcha.widget}
      {button}
      {captcha.error}
    </div>
  );
}
