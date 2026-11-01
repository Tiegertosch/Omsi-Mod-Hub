"use client";

import Script from "next/script";
import { useTranslations } from "next-intl";
import { createElement, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";

import { captchaEndpoint, type CaptchaScope } from "@/lib/captcha";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    /** Gesetzt von public/cap/load.js, sobald das Widget geladen ist. */
    __omsiCapReady?: boolean;
  }
}

/** Das registrierte <cap-widget> (public/cap/widget.js). */
type CapWidgetElement = HTMLElement & { solve?: () => Promise<void>; reset?: () => void };

/** Texte des Widgets; die Schlüssel entsprechen den `data-cap-i18n-*`-Attributen von Cap. */
const I18N_KEYS = [
  "initial-state",
  "verifying-label",
  "solved-label",
  "error-label",
  "required-label",
  "troubleshooting-label",
  "group-aria-label",
  "verify-aria-label",
  "verifying-aria-label",
  "verified-aria-label",
  "error-aria-label",
  "wasm-disabled",
] as const;

const READY_EVENT = "omsi-cap-ready";
/** So lange bleibt „Du bist ein Mensch“ sichtbar, bevor das Formular abgeschickt wird. */
const SOLVED_DELAY_MS = 400;

function subscribeReady(onChange: () => void) {
  window.addEventListener(READY_EVENT, onChange);
  return () => window.removeEventListener(READY_EVENT, onChange);
}

/**
 * Cap im Floating-Modus: Das Widget bleibt verborgen, bis der Absende-Button
 * geklickt wird, erscheint dann über dem Button, löst die Aufgabe, schreibt
 * das Token in das versteckte Feld `cap-token` und sendet das Formular ab.
 * Der Server prüft das Token in der Action (`consumeCaptcha`).
 *
 * Eigene Umsetzung statt cap-floating.js: Dort startet jeder weitere Klick die
 * Anzeige neu und hängt einen zusätzlichen Listener an, sodass mehrfach
 * abgesendet bzw. eine neue Aufgabe geholt wird. Hier sind weitere Klicks
 * gesperrt, solange gelöst oder abgesendet wird.
 *
 * `widget` und der Absende-Button gehören in einen gemeinsamen Container mit
 * `relative` (SubmitButton erledigt das selbst), `trigger` an den Button.
 * `align: "start"` für linksbündige Buttons, sonst ragt das Widget auf
 * schmalen Bildschirmen links heraus. Solange `ready` false ist (Skript noch nicht geladen, ohne
 * JavaScript immer), bleibt der Button gesperrt; sonst ginge ein schneller
 * Klick ohne Token raus.
 */
export function useCaptcha(scope: CaptchaScope, { align = "center" }: { align?: "center" | "start" } = {}) {
  const t = useTranslations("Captcha");
  const ready = useSyncExternalStore(
    subscribeReady,
    () => window.__omsiCapReady === true,
    () => false,
  );
  const widgetRef = useRef<CapWidgetElement | null>(null);
  const submitterRef = useRef<HTMLButtonElement | null>(null);
  // idle → solving (Klick) → submitting (gelöst) → idle (abgeschickt); Fehler → idle
  const phase = useRef<"idle" | "solving" | "submitting">("idle");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Auch ein Klick direkt ins Widget (z. B. nach einem Fehler) löst „solve“ aus.
    const onSolve = () => {
      phase.current = "submitting";
      timer = setTimeout(() => {
        setVisible(false);
        phase.current = "idle";
        const button = submitterRef.current;
        // requestSubmit löst keinen Klick aus, also kein erneuter Durchlauf von onClick.
        button?.form?.requestSubmit(button);
      }, SOLVED_DELAY_MS);
    };
    // Das Widget zeigt den Fehler; ein Klick ins Widget oder auf den Button startet neu.
    const onError = () => {
      phase.current = "idle";
    };

    widget.addEventListener("solve", onSolve);
    widget.addEventListener("error", onError);
    return () => {
      clearTimeout(timer);
      widget.removeEventListener("solve", onSolve);
      widget.removeEventListener("error", onError);
    };
  }, []);

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    const widget = widgetRef.current;
    // Widget nicht geladen: normal absenden, der Server lehnt ohne Token mit Hinweis ab.
    if (!widget?.solve) return;
    event.preventDefault();
    if (phase.current !== "idle") return;

    phase.current = "solving";
    submitterRef.current = event.currentTarget;
    // Jede Anfrage braucht ein neues Token (der Server verbraucht es beim Absenden).
    widget.reset?.();
    setVisible(true);
    void widget.solve();
  };

  const i18n = Object.fromEntries(I18N_KEYS.map((key) => [`data-cap-i18n-${key}`, t(key)]));

  const widget = (
    <>
      {/* Eigener Loader: setzt die lokalen WASM-Pfade und lädt das Widget von /cap/. */}
      <Script src="/cap/load.js" strategy="afterInteractive" />
      {/* Schwebt über dem Button im selben Container. */}
      <div
        className={cn(
          "absolute bottom-full z-50 mb-2 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] transition-opacity duration-150",
          align === "center" ? "left-1/2 -translate-x-1/2" : "left-0",
          visible ? "opacity-100" : "pointer-events-none invisible opacity-0",
        )}
      >
        {createElement("cap-widget", {
          ref: widgetRef,
          "data-cap-api-endpoint": captchaEndpoint(scope),
          ...i18n,
        })}
      </div>
      <noscript>
        <p className="text-sm text-warning">{t("noscript")}</p>
      </noscript>
    </>
  );

  return { widget, trigger: { onClick }, ready };
}
