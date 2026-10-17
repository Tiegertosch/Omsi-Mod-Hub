import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/state";
import { cn } from "@/lib/utils";

/**
 * Zentrierter Rahmen für Anmelde- und Kontoseiten; `header` steht über dem
 * Titel (z. B. Fortschritt). `wide` für Formulare mit zwei Spalten.
 */
export function AuthShell({
  title,
  description,
  header,
  wide = false,
  children,
}: {
  title: string;
  description?: string;
  header?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-center px-4 py-8 sm:py-12">
      <div
        className={cn(
          "w-full rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8",
          wide ? "max-w-2xl" : "max-w-md",
        )}
      >
        {header}
        <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function FormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="space-y-5" aria-busy="true">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}
