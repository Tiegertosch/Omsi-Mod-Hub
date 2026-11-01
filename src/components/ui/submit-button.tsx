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
  captcha?: { trigger: Record<`data-${string}`, string>; ready: boolean };
}) {
  const { pending } = useFormStatus();
  const disabled = pending || captcha?.ready === false;
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-disabled={disabled}
      className={buttonStyles({ variant, size: "lg", className })}
      {...captcha?.trigger}
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
}
