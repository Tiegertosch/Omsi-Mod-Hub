import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover shadow-[0_8px_24px_-10px_rgb(246_167_35/0.6)]",
  secondary: "bg-surface-3 text-fg hover:bg-border-strong border border-border-strong",
  ghost: "text-muted hover:text-fg hover:bg-surface-3",
  outline: "border border-border-strong text-fg hover:border-accent hover:text-accent",
} as const;

const sizes = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "h-10 w-10",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

/** Gemeinsame Klassen für Buttons und wie Buttons gestaltete Links. */
export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}
