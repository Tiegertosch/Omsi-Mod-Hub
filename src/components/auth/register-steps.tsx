import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";

/** Fortschritt der Registrierung in einer Zeile: zwei verbundene Punkte (Konto anlegen → E-Mail bestätigen). */
export async function RegisterSteps({ current }: { current: 1 | 2 }) {
  const t = await getTranslations("Auth");
  const steps = [t("stepAccount"), t("stepConfirm")];

  return (
    <nav aria-label={t("stepsLabel")} className="mb-6">
      <ol className="flex items-center gap-3">
        {steps.map((label, index) => {
          const step = index + 1;
          const done = step < current;
          const active = step === current;
          return (
            <li key={label} className={cn("flex items-center gap-3", step < steps.length && "flex-1")}>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    done && "border-accent bg-accent text-accent-fg",
                    active && "border-accent bg-accent-soft text-accent",
                    !done && !active && "border-border-strong bg-surface-2 text-subtle",
                  )}
                >
                  {done ? <Check aria-hidden className="size-3.5" /> : step}
                </span>
                <span className={cn("text-xs leading-tight font-medium", active || done ? "text-fg" : "text-subtle")}>
                  <span className="sr-only">{t("stepOf", { step, total: steps.length })} </span>
                  {label}
                </span>
              </span>
              {step < steps.length ? (
                <span aria-hidden className={cn("h-0.5 min-w-4 flex-1 rounded-full", done ? "bg-accent" : "bg-border-strong")} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
