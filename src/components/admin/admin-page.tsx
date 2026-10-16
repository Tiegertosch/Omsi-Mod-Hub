import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function AdminPageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-fg">{title}</h1>
      {description ? <p className="mt-2 text-muted">{description}</p> : null}
    </header>
  );
}

/** Filterleiste aus Links, damit der Filter in der URL steht. */
export function FilterTabs<T extends string>({
  label,
  items,
  active,
  hrefFor,
}: {
  label: string;
  items: { value: T; label: ReactNode }[];
  active: T;
  hrefFor: (value: T) => { pathname: string; query?: Record<string, string> };
}) {
  return (
    <nav aria-label={label} className="-mx-4 mb-6 overflow-x-auto px-4">
      <ul className="flex w-max gap-2">
        {items.map((item) => (
          <li key={item.value}>
            <Link
              href={hrefFor(item.value)}
              aria-current={item.value === active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                item.value === active
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-muted hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AdminCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-[var(--radius-card)] border border-border bg-surface p-5", className)}>{children}</div>
  );
}

export function ListSkeleton({ rows = 3, height = "h-32" }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-4" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={cn("animate-pulse rounded-[var(--radius-card)] bg-surface-3", height)} />
      ))}
    </div>
  );
}
