"use client";

import Script from "next/script";
import { useTranslations } from "next-intl";
import { createElement, useId, useSyncExternalStore } from "react";

import { captchaEndpoint, type CaptchaScope } from "@/lib/captcha";

declare global {
  interface Window {
    /** Gesetzt von public/cap/load.js, sobald Widget und Floating-Modus geladen sind. */
    __omsiCapReady?: boolean;
  }
}

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

function subscribeReady(onChange: () => void) {
  window.addEventListener(READY_EVENT, onChange);
  return () => window.removeEventListener(READY_EVENT, onChange);
}

/**
 * Cap im Floating-Modus: Das Widget bleibt unsichtbar, bis der Absende-Button
 * geklickt wird, löst dann die Aufgabe, schreibt das Token in das versteckte
 * Feld `cap-token` und sendet das Formular selbst ab. Der Server prüft das
 * Token in der Action (`consumeCaptcha`).
 *
 * `widget` gehört in das Formular, `trigger` an den Absende-Button. Solange
 * `ready` false ist (Skripte noch nicht geladen, ohne JavaScript immer), bleibt
 * der Button gesperrt; sonst ginge ein schneller Klick ohne Token raus. Die ID
 * ist eindeutig, weil per <Activity> mehrere Seiten mit demselben Formular im
 * DOM liegen können.
 */
export function useCaptcha(scope: CaptchaScope) {
  const t = useTranslations("Captcha");
  const id = `cap-${scope}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ready = useSyncExternalStore(
    subscribeReady,
    () => window.__omsiCapReady === true,
    () => false,
  );

  const i18n = Object.fromEntries(I18N_KEYS.map((key) => [`data-cap-i18n-${key}`, t(key)]));

  const widget = (
    <>
      {/* Eigener Loader: setzt die lokalen WASM-Pfade und lädt Widget und Floating-Modus von /cap/. */}
      <Script src="/cap/load.js" strategy="afterInteractive" />
      {createElement("cap-widget", {
        id,
        "data-cap-api-endpoint": captchaEndpoint(scope),
        ...i18n,
      })}
      <noscript>
        <p className="text-sm text-warning">{t("noscript")}</p>
      </noscript>
    </>
  );

  const trigger = { "data-cap-floating": `#${id}`, "data-cap-floating-position": "top" } as const;

  return { widget, trigger, ready };
}
