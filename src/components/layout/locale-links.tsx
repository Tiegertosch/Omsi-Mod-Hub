import type { ReactNode } from "react";

import { localeLabels, routing, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/** Darstellung der Sprachauswahl; der Link-Typ wird vom Aufrufer bestimmt. */
export function LocaleLinks({
  label,
  current,
  renderLink,
}: {
  label: string;
  current: string;
  renderLink: (target: AppLocale, children: ReactNode, className: string) => ReactNode;
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex items-center rounded-lg border border-border bg-surface-2 p-0.5">
        {routing.locales.map((target) => {
          const active = target === current;
          return (
            <li key={target}>
              {active ? (
                <span
                  aria-current="true"
                  className="block rounded-md bg-surface-3 px-2.5 py-1 text-xs font-semibold uppercase text-fg"
                >
                  <span aria-hidden>{target}</span>
                  <span className="sr-only">{localeLabels[target]}</span>
                </span>
              ) : (
                renderLink(
                  target,
                  <>
                    <span aria-hidden>{target}</span>
                    <span className="sr-only">{localeLabels[target]}</span>
                  </>,
                  cn(
                    "block rounded-md px-2.5 py-1 text-xs font-semibold uppercase text-muted transition-colors hover:text-fg",
                  ),
                )
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
