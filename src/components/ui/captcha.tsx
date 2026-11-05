"use client";

import Script from "next/script";
import { useTranslations } from "next-intl";
import { createElement, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";

import { captchaEndpoint, type CaptchaScope } from "@/lib/captcha";

declare global {
  interface Window {
    /** Gesetzt von public/cap/load.js, sobald das Widget geladen ist. */
    __omsiCapReady?: boolean;
  }
}

/** Das registrierte <cap-widget> (public/cap/widget.js). */
type CapWidgetElement = HTMLElement & {
  solve?: () => Promise<{ success: boolean; token: string } | undefined>;
  reset?: () => void;
};

const READY_EVENT = "omsi-cap-ready";
/** So lange wartet ein Absenden höchstens darauf, dass das Widget geladen ist. */
const LOAD_TIMEOUT_MS = 20_000;

const noop = () => () => {};

/** Erfüllt, sobald public/cap/load.js das Widget registriert hat. */
function widgetLoaded(): Promise<void> {
  if (window.__omsiCapReady === true) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => {
      window.clearTimeout(timer);
      window.removeEventListener(READY_EVENT, done);
      resolve();
    };
    const timer = window.setTimeout(() => {
      window.removeEventListener(READY_EVENT, done);
      reject(new Error("Cap: Widget nicht geladen"));
    }, LOAD_TIMEOUT_MS);
    window.addEventListener(READY_EVENT, done);
  });
}

/**
 * Cap ohne sichtbares Widget: Der Klick auf den Absende-Button löst die
 * Aufgabe, währenddessen zeigt der Button „Wird geprüft …“. Danach steht das
 * Token im versteckten Feld `cap-token` des (verborgenen) Widgets, und das
 * Formular wird abgeschickt. Der Server prüft es in der Action
 * (`consumeCaptcha`).
 *
 * Statt cap-floating.js: Dort startete jeder weitere Klick die Anzeige neu und
 * sendete mehrfach ab. Hier ist der Button gesperrt, solange geprüft wird, und
 * abgesendet wird per requestSubmit() (kein erneuter Klick).
 *
 * `widget` muss im Formular stehen (SubmitButton erledigt das), `trigger` an
 * den Button. `ready` ist false, bis die Seite hydriert ist (ohne JavaScript
 * immer): So lange bleibt der Button gesperrt, sonst ginge ein Klick ohne
 * Token raus. Danach ist er immer aktiv – auch bevor das Widget geladen ist.
 * Ein Klick oder Enter wartet dann auf das Widget (Anzeige „Wird geprüft …“);
 * früher war der Button bis dahin gesperrt, und ein Enter direkt nach dem
 * Ausfüllen (z. B. durch den Passwortmanager) verpuffte.
 */
export function useCaptcha(scope: CaptchaScope) {
  const t = useTranslations("Captcha");
  // true nur im Browser nach der Hydration (Server und erster Render: false).
  const ready = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const widgetRef = useRef<CapWidgetElement | null>(null);
  const busy = useRef(false);
  const [solving, setSolving] = useState(false);
  const [failed, setFailed] = useState(false);

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (busy.current) return;

    busy.current = true;
    setSolving(true);
    setFailed(false);
    const form = event.currentTarget.form;
    widgetLoaded()
      .then(() => {
        const widget = widgetRef.current;
        if (!widget?.solve) throw new Error("Cap: Widget fehlt");
        // Jede Anfrage braucht ein neues Token (der Server verbraucht es beim Absenden).
        widget.reset?.();
        return widget.solve();
      })
      .then((result) => {
        if (!result?.success) throw new Error("Cap: keine Lösung");
        // requestSubmit löst keinen Klick aus, also kein erneuter Durchlauf von onClick.
        form?.requestSubmit();
      })
      .catch(() => setFailed(true))
      .finally(() => {
        busy.current = false;
        setSolving(false);
      });
  };

  const widget = (
    <>
      {/* Eigener Loader: setzt die lokalen WASM-Pfade und lädt das Widget von /cap/. */}
      <Script src="/cap/load.js" strategy="afterInteractive" />
      {/* Verborgen; liefert nur die Lösung und das Feld `cap-token`. */}
      {createElement("cap-widget", {
        ref: widgetRef,
        className: "hidden",
        "data-cap-api-endpoint": captchaEndpoint(scope),
        "data-cap-disable-haptics": "",
      })}
      <noscript>
        <p className="text-sm text-warning">{t("noscript")}</p>
      </noscript>
    </>
  );

  const error = failed ? (
    <p role="alert" className="mt-2 text-sm text-danger">
      {t("error")}
    </p>
  ) : null;

  return { widget, trigger: { onClick }, ready, solving, verifyingLabel: t("verifying"), error };
}
