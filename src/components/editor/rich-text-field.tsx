"use client";

import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Underline, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { RichText } from "@/components/ui/rich-text";
import { cn } from "@/lib/utils";

type Format = "bold" | "italic" | "underline" | "heading" | "subheading" | "bulletList" | "numberedList";

const WRAP: Partial<Record<Format, string>> = { bold: "**", italic: "*", underline: "++" };
const HEADING_PREFIX: Partial<Record<Format, string>> = { heading: "## ", subheading: "### " };
const SHORTCUTS: Record<string, Format> = { b: "bold", i: "italic", u: "underline" };

const BUTTONS: { format: Format; icon: LucideIcon; shortcut?: string }[] = [
  { format: "bold", icon: Bold, shortcut: "B" },
  { format: "italic", icon: Italic, shortcut: "I" },
  { format: "underline", icon: Underline, shortcut: "U" },
  { format: "heading", icon: Heading2 },
  { format: "subheading", icon: Heading3 },
  { format: "bulletList", icon: List },
  { format: "numberedList", icon: ListOrdered },
];

const HEADING_START = /^#{1,3}\s+/;
const BULLET_START = /^\s*[-*•]\s+/;
const NUMBER_START = /^\s*\d{1,4}[.)]\s+/;

/**
 * Ersetzt einen Bereich so, dass Strg+Z die Änderung zurücknimmt
 * (execCommand fügt sie in den Rückgängig-Verlauf ein); sonst setRangeText.
 */
function replaceRange(textarea: HTMLTextAreaElement, start: number, end: number, text: string) {
  textarea.focus();
  textarea.setSelectionRange(start, end);
  if (!document.execCommand("insertText", false, text)) textarea.setRangeText(text, start, end, "end");
}

/** Steht die Auswahl schon in diesen Zeichen? Bei Sternchen zählt die Länge der Folge (fett = 2, kursiv = 1, beides = 3). */
function isWrapped(value: string, start: number, end: number, token: string) {
  if (token === "++") return value.slice(start - 2, start) === "++" && value.slice(end, end + 2) === "++";
  const before = value.slice(0, start).match(/\*+$/)?.[0].length ?? 0;
  const after = value.slice(end).match(/^\*+/)?.[0].length ?? 0;
  const matches = (run: number) => (token === "**" ? run >= 2 : run === 1 || run === 3);
  return matches(before) && matches(after);
}

/** Fett/Kursiv/Unterstrichen: Auswahl umschließen, erneutes Anwenden entfernt die Zeichen wieder. */
function toggleWrap(textarea: HTMLTextAreaElement, token: string, placeholder: string) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const selected = value.slice(start, end);
  if (isWrapped(value, start, end, token)) {
    replaceRange(textarea, start - token.length, end + token.length, selected);
    textarea.setSelectionRange(start - token.length, end - token.length);
    return;
  }
  // Leerzeichen am Rand der Auswahl bleiben außerhalb, sonst greift die Formatierung nicht.
  const inner = selected.trim() || placeholder;
  const leading = selected.match(/^\s*/)?.[0] ?? "";
  const trailing = selected.trim() ? (selected.match(/\s*$/)?.[0] ?? "") : "";
  replaceRange(textarea, start, end, `${leading}${token}${inner}${token}${trailing}`);
  const innerStart = start + leading.length + token.length;
  textarea.setSelectionRange(innerStart, innerStart + inner.length);
}

/** Überschriften und Listen: wirken auf alle ausgewählten Zeilen und lassen sich wieder entfernen. */
function toggleLines(textarea: HTMLTextAreaElement, format: Format) {
  const { selectionStart, selectionEnd, value } = textarea;
  const start = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const endBreak = value.indexOf("\n", selectionEnd);
  const end = endBreak === -1 ? value.length : endBreak;
  const lines = value.slice(start, end).split("\n");

  let next: string[];
  const heading = HEADING_PREFIX[format];
  if (heading) {
    const active = lines.every((line) => line.startsWith(heading));
    next = lines.map((line) => (active ? line.slice(heading.length) : heading + line.replace(HEADING_START, "")));
  } else {
    const pattern = format === "bulletList" ? BULLET_START : NUMBER_START;
    const content = lines.filter((line) => line.trim());
    const active = content.length > 0 && content.every((line) => pattern.test(line));
    let number = 0;
    next = lines.map((line) => {
      if (active) return line.replace(pattern, "");
      if (!line.trim() && lines.length > 1) return line;
      const text = line.replace(HEADING_START, "").replace(BULLET_START, "").replace(NUMBER_START, "");
      number++;
      return format === "bulletList" ? `- ${text}` : `${number}. ${text}`;
    });
  }
  const replacement = next.join("\n");
  replaceRange(textarea, start, end, replacement);
  textarea.setSelectionRange(start + replacement.length, start + replacement.length);
}

/**
 * Textfeld mit Werkzeugleiste und Vorschau. Das Feld bleibt ein normales
 * Textarea (auch in der Vorschau, dann ausgeblendet) und wird mit dem
 * Formular gesendet; gespeichert werden nur Text und Formatierungszeichen.
 */
export function RichTextField({
  id,
  name,
  label,
  defaultValue,
  rows,
  maxLength,
  error,
}: {
  id: string;
  name: string;
  label: ReactNode;
  defaultValue: string;
  rows: number;
  maxLength: number;
  error?: string;
}) {
  const t = useTranslations("Editor.format");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const apply = (format: Format) => {
    const field = textarea.current;
    if (!field) return;
    const token = WRAP[format];
    if (token) toggleWrap(field, token, t("placeholder"));
    else toggleLines(field, format);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    const format = SHORTCUTS[event.key.toLowerCase()];
    if (!format) return;
    event.preventDefault();
    apply(format);
  };

  const showPreview = () => setPreview(textarea.current?.value ?? "");
  const previewEmpty = preview !== null && !preview.trim();

  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <label id={`${id}-label`} htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <div
        className={cn(
          "overflow-hidden rounded-lg border bg-surface-2 transition-colors focus-within:border-accent",
          error ? "border-danger" : "border-border hover:border-border-strong",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-1.5 py-1">
          <div role="toolbar" aria-label={t("toolbar")} aria-controls={id} className="flex flex-wrap items-center">
            {BUTTONS.map(({ format, icon: Icon, shortcut }) => (
              <button
                key={format}
                type="button"
                disabled={preview !== null}
                onClick={() => apply(format)}
                title={shortcut ? t("withShortcut", { label: t(format), key: shortcut }) : t(format)}
                aria-label={t(format)}
                aria-keyshortcuts={shortcut ? `Control+${shortcut}` : undefined}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:pointer-events-none disabled:opacity-40",
                  (format === "heading" || format === "bulletList") && "ml-1.5 border-l border-border pl-0.5",
                )}
              >
                <Icon aria-hidden className="size-4" />
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 text-xs font-medium">
            <button
              type="button"
              aria-pressed={preview === null}
              onClick={() => {
                setPreview(null);
                requestAnimationFrame(() => textarea.current?.focus());
              }}
              className="rounded-md px-2.5 py-1.5 text-muted transition-colors hover:text-fg aria-pressed:bg-surface-3 aria-pressed:text-fg"
            >
              {t("write")}
            </button>
            <button
              type="button"
              aria-pressed={preview !== null}
              onClick={showPreview}
              className="rounded-md px-2.5 py-1.5 text-muted transition-colors hover:text-fg aria-pressed:bg-surface-3 aria-pressed:text-fg"
            >
              {t("preview")}
            </button>
          </div>
        </div>

        <textarea
          ref={textarea}
          id={id}
          name={name}
          defaultValue={defaultValue}
          rows={rows}
          maxLength={maxLength}
          hidden={preview !== null}
          onKeyDown={onKeyDown}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? errorId : null, hintId].filter(Boolean).join(" ")}
          className="block min-h-24 w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-relaxed text-fg placeholder:text-subtle focus:outline-none"
        />
        {preview !== null ? (
          <div className="min-h-24 px-4 py-3" aria-live="polite">
            {previewEmpty ? <p className="text-sm text-subtle">{t("previewEmpty")}</p> : <RichText text={preview} />}
          </div>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : null}
      <p id={hintId} className="mt-1.5 text-xs text-subtle">
        {t("hint")}
      </p>
    </div>
  );
}
