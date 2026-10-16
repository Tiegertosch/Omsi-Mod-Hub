/**
 * Validierung externer Download-URLs.
 *
 * Externe URLs sind grundsätzlich nicht vertrauenswürdig. Akzeptiert werden nur
 * öffentliche http(s)-Ziele ohne eingebettete Zugangsdaten. Lokale und private
 * Ziele werden abgelehnt, damit eine spätere automatische Linkprüfung keine
 * internen Dienste erreichen kann (SSRF). Die Prüfung erfolgt rein syntaktisch –
 * eine Linkprüfung muss zusätzlich die per DNS aufgelöste IP-Adresse prüfen.
 */

export const MAX_EXTERNAL_URL_LENGTH = 2048;

export type ExternalUrlError =
  | "too_long"
  | "invalid"
  | "protocol"
  | "credentials"
  | "host";

export type ExternalUrlResult =
  | { ok: true; url: string; host: string; provider: string }
  | { ok: false; error: ExternalUrlError };

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback"]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa"];

function isPrivateIPv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIPv6(host: string): boolean {
  if (!host.startsWith("[")) return false;
  const addr = host.slice(1, -1).toLowerCase();
  return (
    addr === "::" ||
    addr === "::1" ||
    addr.startsWith("fc") ||
    addr.startsWith("fd") ||
    addr.startsWith("fe8") ||
    addr.startsWith("fe9") ||
    addr.startsWith("fea") ||
    addr.startsWith("feb") ||
    addr.startsWith("::ffff:")
  );
}

export function isPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || BLOCKED_HOSTNAMES.has(host)) return false;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;
  if (isPrivateIPv4(host) || isBlockedIPv6(host)) return false;
  // Hostnamen ohne Punkt (z. B. "intranet") sind keine öffentlichen Ziele.
  if (!host.startsWith("[") && !host.includes(".")) return false;
  return true;
}

export function parseExternalUrl(input: string): ExternalUrlResult {
  const raw = input.trim();
  if (raw.length > MAX_EXTERNAL_URL_LENGTH) return { ok: false, error: "too_long" };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: "invalid" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "protocol" };
  }
  if (parsed.username || parsed.password) return { ok: false, error: "credentials" };
  if (!isPublicHostname(parsed.hostname)) return { ok: false, error: "host" };

  const host = parsed.hostname.toLowerCase();
  return {
    ok: true,
    url: parsed.toString(),
    host,
    provider: host.replace(/^www\./, ""),
  };
}

/** Liefert den anzuzeigenden Hostnamen oder null, wenn die URL nicht zulässig ist. */
export function externalHost(input: string): string | null {
  const result = parseExternalUrl(input);
  return result.ok ? result.provider : null;
}

/**
 * Bildquellen: Bis zur Implementierung von Bild-Uploads sind nur lokale Pfade
 * unterhalb von /public erlaubt (keine protokollrelativen URLs).
 */
export function isSafeImageSrc(src: string | null | undefined): src is string {
  return typeof src === "string" && src.startsWith("/") && !src.startsWith("//") && !src.includes("..");
}
