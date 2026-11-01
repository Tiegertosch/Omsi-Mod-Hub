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

function subscribeReady(onChange: () => void) {
  window.addEventListener(READY_EVENT, onChange);
  return () => window.removeEventListener(READY_EVENT, onChange);
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
 * den Button. Solange `ready` false ist (Skript noch nicht geladen, ohne
 * JavaScript immer), bleibt der Button gesperrt; sonst ginge ein schneller
 * Klick ohne Token raus.
 */
export function useCaptcha(scope: CaptchaScope) {
  const t = useTranslations("Captcha");
  const ready = useSyncExternalStore(
    subscribeReady,
    () => window.__omsiCapReady === true,
    () => false,
  );
  const widgetRef = useRef<CapWidgetElement | null>(null);
  const busy = useRef(false);
  const [solving, setSolving] = useState(false);
  const [failed, setFailed] = useState(false);

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    const widget = widgetRef.current;
    // Widget nicht geladen: normal absenden, der Server lehnt ohne Token mit Hinweis ab.
    if (!widget?.solve) return;
    event.preventDefault();
    if (busy.current) return;

    busy.current = true;
    setSolving(true);
    setFailed(false);
    const form = event.currentTarget.form;
    // Jede Anfrage braucht ein neues Token (der Server verbraucht es beim Absenden).
    widget.reset?.();
    widget
      .solve()
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
