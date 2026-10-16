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
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: ButtonVariant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={buttonStyles({ variant, size: "lg", className })}
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
