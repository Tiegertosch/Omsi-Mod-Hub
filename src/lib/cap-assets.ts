/**
 * Dateien des Cap-Widgets, die unter /cap/ von der eigenen Domain ausgeliefert
 * werden (CSP erlaubt nur 'self'; ohne Angabe lädt das Widget WASM von jsDelivr).
 * Quelle: node_modules, Ziel: public/cap. Nach einem Update von cap-widget oder
 * @cap.js/wasm `pnpm cap:assets` ausführen; tests/unit/cap-assets.test.ts prüft,
 * dass die Kopien zum installierten Paket passen.
 */
export const CAP_ASSETS = [
  { from: "node_modules/cap-widget/cap.min.js", to: "public/cap/widget.js" },
  { from: "node_modules/cap-widget/cap-floating.min.js", to: "public/cap/floating.js" },
  { from: "node_modules/cap-widget/LICENSE", to: "public/cap/LICENSE.txt" },
  { from: "node_modules/@cap.js/wasm/browser/cap_wasm_bg.wasm", to: "public/cap/cap_wasm_bg.wasm" },
  { from: "node_modules/@cap.js/wasm/browser/hashwx.wasm", to: "public/cap/hashwx.wasm" },
] as const;
