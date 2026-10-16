import { CircleAlert, CircleCheck } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const inputClass =
  "h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-subtle transition-colors hover:border-border-strong focus:border-accent focus:outline-none aria-[invalid=true]:border-danger";

/** Beschriftetes Eingabefeld mit verknüpftem Hinweis- und Fehlertext. */
export function TextField({
  id,
  label,
  hint,
  error,
  className,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClass}
        {...input}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: unknown) {
  return [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
}

function FieldMessages({ id, hint, error }: { id: string; hint?: ReactNode; error?: string }) {
  return (
    <>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-subtle">
          {hint}
        </p>
      ) : null}
    </>
  );
}

/** Mehrzeiliges Textfeld mit Hinweis- und Fehlertext. */
export function TextAreaField({
  id,
  label,
  hint,
  error,
  className,
  ...textarea
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; label: ReactNode; hint?: ReactNode; error?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(inputClass, "h-auto min-h-24 py-2.5 leading-relaxed")}
        {...textarea}
      />
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

/** Auswahlliste mit Hinweis- und Fehlertext. */
export function SelectField({
  id,
  label,
  hint,
  error,
  className,
  children,
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> & { id: string; label: ReactNode; hint?: ReactNode; error?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={inputClass}
        {...select}
      >
        {children}
      </select>
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

/** Rückmeldung zu einem Formular (Fehler oder Erfolg). */
export function FormAlert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
        tone === "error" ? "border-danger/40 bg-danger/10 text-fg" : "border-success/40 bg-success/10 text-fg",
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone === "error" ? "text-danger" : "text-success")} />
      <div>{children}</div>
    </div>
  );
}
