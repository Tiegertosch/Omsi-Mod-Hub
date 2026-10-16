import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/state";

/** Zentrierter Rahmen für Anmelde- und Kontoseiten. */
export function AuthShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex justify-center px-4 py-14 sm:py-20">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
        <div className="mt-7">{children}</div>
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
