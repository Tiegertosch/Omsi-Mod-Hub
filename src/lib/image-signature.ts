export type ImageKind = "jpeg" | "png" | "webp";

/**
 * Erkennt das Bildformat anhand der Datei-Signatur („Magic Bytes“).
 * Dateiname und vom Browser gemeldeter MIME-Typ sind nicht vertrauenswürdig.
 */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

/** Medien-Schlüssel: zufällige Hex-ID + Endung, ohne Pfadanteile. */
export const MEDIA_KEY_PATTERN = /^[a-f0-9]{32}\.webp$/;

export function mediaUrlFromKey(key: string) {
  return `/media/${key}`;
}

export function mediaKeyFromUrl(url: string | null | undefined): string | null {
  if (!url?.startsWith("/media/")) return null;
  const key = url.slice("/media/".length);
  return MEDIA_KEY_PATTERN.test(key) ? key : null;
}
