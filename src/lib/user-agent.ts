/**
 * Grobe Erkennung von Browser und Betriebssystem aus dem User-Agent, nur für
 * die Sitzungsübersicht. Der User-Agent ist frei wählbar und daher kein
 * Sicherheitsmerkmal; unbekannte Werte ergeben null.
 */
export type DeviceInfo = { browser: string | null; os: string | null };

// Reihenfolge ist wichtig: Edge und Opera enthalten auch "Chrome", Chrome enthält "Safari".
const BROWSERS: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\b(?:OPR|Opera)\//, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\b(?:Firefox|FxiOS)\//, "Firefox"],
  [/\b(?:Chrome|CriOS|Chromium)\//, "Chrome"],
  [/\bVersion\/[\d.]+.*\bSafari\//, "Safari"],
];

// iOS vor macOS ("like Mac OS X"), Android vor Linux.
const SYSTEMS: [RegExp, string][] = [
  [/\b(?:iPhone|iPad|iPod)\b/, "iOS"],
  [/\bAndroid\b/, "Android"],
  [/\bWindows\b/, "Windows"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bMac OS X\b|\bMacintosh\b/, "macOS"],
  [/\bLinux\b/, "Linux"],
];

const MAX_LENGTH = 512;

export function describeUserAgent(userAgent: string | null | undefined): DeviceInfo {
  const ua = (userAgent ?? "").slice(0, MAX_LENGTH);
  if (!ua) return { browser: null, os: null };
  return {
    browser: BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? null,
    os: SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1] ?? null,
  };
}
