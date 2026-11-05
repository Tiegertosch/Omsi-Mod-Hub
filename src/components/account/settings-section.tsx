import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Ein Bereich der Einstellungen: Titel, optionale Beschreibung, Inhalt. Alle
 * Bereiche einer Unterseite stehen in einer Spalte mit gleicher Breite.
 * `id` ist zugleich Sprungziel (z. B. #two-factor) und Name der Region.
 */
export function SettingsSection({
  id,
  title,
  description,
  danger,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  /** Gefahrenbereich (Konto löschen): roter Rahmen */
  danger?: boolean;
  /** Rechts neben dem Titel, z. B. Link zum öffentlichen Profil */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        "scroll-mt-24 rounded-[var(--radius-card)] border bg-surface p-6",
        danger ? "border-danger/40" : "border-border",
      )}
    >
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className={cn("text-lg font-semibold", danger ? "text-danger" : "text-fg")}>
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
