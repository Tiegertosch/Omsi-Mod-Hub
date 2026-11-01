// Lädt das selbst gehostete Cap-Widget (src/components/ui/captcha.tsx).
// Alle Dateien kommen von /cap/ (eigene Domain); ohne diese Angaben würde das
// Widget WebAssembly von jsDelivr nachladen, was die CSP ohnehin blockiert.
(function () {
  if (window.__omsiCapLoading) return;
  window.__omsiCapLoading = true;

  window.CAP_CUSTOM_WASM_URL = "/cap/cap_wasm_bg.wasm";
  window.CAP_CUSTOM_HASHWX_URL = "/cap/hashwx.wasm";
  // Der Hinweis-Link auf trycap.dev soll keine Seitenadresse mitschicken.
  window.CAP_DISABLE_WIDGET_REF = true;

  // Bis hierhin sind die Absende-Buttons gesperrt (useCaptcha). Auch bei einem
  // Ladefehler freigeben: Dann lehnt der Server ohne Token mit Hinweis ab, statt
  // dass der Button dauerhaft gesperrt bleibt.
  function ready() {
    window.__omsiCapReady = true;
    window.dispatchEvent(new Event("omsi-cap-ready"));
  }

  function load(src, onload) {
    var script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = onload;
    script.onerror = ready;
    document.head.appendChild(script);
  }

  // Die Prüfung startet useCaptcha beim Klick auf den Absende-Button.
  load("/cap/widget.js", ready);
})();
