"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { buttonStyles, type ButtonVariant } from "./button";

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
  /** Ergebnis von useCaptcha: Der Klick löst zuerst das Cap-Widget aus; gesperrt, bis es geladen ist. */
  captcha?: { widget: React.ReactNode; trigger: { onClick: React.MouseEventHandler<HTMLButtonElement> }; ready: boolean };
}) {
  const { pending } = useFormStatus();
  const disabled = pending || captcha?.ready === false;
  const button = (
    <button
      type="submit"
      disabled={disabled}
      aria-disabled={disabled}
      className={buttonStyles({ variant, size: "lg", className })}
      onClick={captcha?.trigger.onClick}
    >
      {pending ? (
        <>
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
  if (!captcha) return button;
  return (
    <div className="relative">
      {captcha.widget}
      {button}
    </div>
  );
}
