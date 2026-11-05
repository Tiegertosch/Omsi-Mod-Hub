import { encode } from "uqr";

export type QrPath = { size: number; path: string };

/**
 * QR-Code als SVG-Pfad (ein Rechteck je dunklem Modul, Zeilen zusammengefasst).
 * Gerendert wird er als <svg><path d=…> – ohne innerHTML und ohne data:-URL,
 * passend zur CSP. Fehlerkorrektur M, Ruhezone 4 Module (Standard).
 */
export function qrPath(text: string): QrPath {
  const { data, size } = encode(text, { ecc: "M", border: 4 });
  let path = "";
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!data[y][x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < size && data[y][x]) x++;
      path += `M${start} ${y}h${x - start}v1h-${x - start}z`;
    }
  }
  return { size, path };
}
