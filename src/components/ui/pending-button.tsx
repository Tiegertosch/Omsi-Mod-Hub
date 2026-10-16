import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { buttonStyles, type ButtonSize, type ButtonVariant } from "./button";

/** Absende-Button mit Ladezustand, gesteuert über `pending` (z. B. aus useActionState). */
export function PendingButton({
  pending,
  pendingLabel,
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      aria-disabled={pending || props.disabled}
      className={buttonStyles({ variant, size, className })}
      {...props}
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
