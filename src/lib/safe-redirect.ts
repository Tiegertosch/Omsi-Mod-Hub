import { routing } from "@/i18n/routing";

const LOCALE_PATH = new RegExp(`^/(${routing.locales.join("|")})(?:[/?#]|$)`);

/**
 * Prüft ein Weiterleitungsziel (z. B. `?next=` nach dem Login).
 * Erlaubt sind nur relative Pfade innerhalb der lokalisierten App – keine
 * fremden Hosts, keine protokollrelativen URLs (Open-Redirect-Schutz).
 */
export function safeRedirectPath(target: unknown, fallback: string): string {
  if (typeof target !== "string" || target.length === 0 || target.length > 512) return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(target)) return fallback;
  try {
    // Erst normalisieren (löst z. B. "/de/../x" auf), dann prüfen.
    const url = new URL(target, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return fallback;
    const normalized = `${url.pathname}${url.search}${url.hash}`;
    return LOCALE_PATH.test(normalized) ? normalized : fallback;
  } catch {
    return fallback;
  }
}
