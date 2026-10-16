import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Einheitlicher Leer- bzw. Fehlerzustand. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  tone = "neutral",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "danger";
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center rounded-[var(--radius-card)] border border-dashed px-6 py-12 text-center",
        tone === "danger" ? "border-danger/40 bg-danger/5" : "border-border-strong bg-surface/60",
        className,
      )}
    >
      {Icon ? (
        <Icon aria-hidden className={cn("mb-4 size-8", tone === "danger" ? "text-danger" : "text-subtle")} />
      ) : null}
      <h3 className="text-lg font-semibold text-fg">{title}</h3>
      {children ? <div className="mt-2 max-w-md text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-3", className)} />;
}

export function Notice({
  title,
  children,
  tone = "warning",
  className,
}: {
  title?: string;
  children: ReactNode;
  tone?: "warning" | "info";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        tone === "warning" ? "border-warning/30 bg-warning/5 text-warning" : "border-info/30 bg-info/5 text-info",
        className,
      )}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={cn(title && "mt-1", "text-fg/85")}>{children}</div>
    </div>
  );
}
