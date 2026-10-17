"use client";

import { useTranslations } from "next-intl";
import { useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

/**
 * Code-Eingabe mit einem Feld pro Ziffer. Die Felder sind ungesteuert und
 * heißen alle „code“: Ohne JavaScript setzt der Server die Ziffern zusammen,
 * und nach dem Absenden leert React das Formular von selbst. Einfügen und
 * Autofill (`one-time-code`) verteilen einen ganzen Code auf die Felder.
 */
export function CodeInput({ id, length, label, error }: { id: string; length: number; label: string; error?: string }) {
  const t = useTranslations("Auth");
  const fields = useRef<(HTMLInputElement | null)[]>([]);
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;

  const focusField = (index: number) => {
    const field = fields.current[Math.max(0, Math.min(length - 1, index))];
    field?.focus();
    field?.select();
  };

  // Schreibt Ziffern ab `start` in die Felder und setzt den Fokus dahinter.
  const fillFrom = (start: number, digits: string) => {
    let index = start;
    for (const digit of digits) {
      if (index >= length) break;
      const field = fields.current[index];
      if (field) field.value = digit;
      index++;
    }
    focusField(index);
  };

  const onChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.currentTarget.value.replace(/\D/g, "");
    event.currentTarget.value = "";
    if (digits) fillFrom(index, digits);
  };

  const onPaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
    const digits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!digits) return;
    event.preventDefault();
    fillFrom(index, digits);
  };

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    const field = event.currentTarget;
    if (event.key === "Backspace" && field.value === "" && index > 0) {
      event.preventDefault();
      const previous = fields.current[index - 1];
      if (previous) previous.value = "";
      focusField(index - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusField(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusField(index + 1);
    }
  };

  return (
    <div>
      <p id={labelId} className="mb-1.5 text-sm font-medium text-fg">
        {label}
      </p>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : undefined}
        className="flex justify-between gap-1.5 sm:gap-2.5"
      >
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(element) => {
              fields.current[index] = element;
            }}
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoFocus={index === 0}
            aria-label={t("codeDigit", { index: index + 1, total: length })}
            aria-invalid={error ? true : undefined}
            onChange={onChange(index)}
            onPaste={onPaste(index)}
            onKeyDown={onKeyDown(index)}
            onFocus={(event) => event.currentTarget.select()}
            className={cn(
              "h-12 w-10 rounded-lg border border-border bg-surface-2 text-center font-mono text-xl font-semibold text-fg sm:h-14 sm:w-12",
              "transition-colors hover:border-border-strong focus:border-accent focus:outline-none aria-[invalid=true]:border-danger",
            )}
          />
        ))}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
