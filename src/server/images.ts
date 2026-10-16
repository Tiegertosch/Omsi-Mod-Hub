import "server-only";

import sharp from "sharp";

import { detectImageKind } from "@/lib/image-signature";
import { IMAGE_MAX_BYTES, IMAGE_MAX_EDGE, IMAGE_MAX_INPUT_PIXELS, IMAGE_MIN_EDGE } from "@/lib/project-rules";

export type ImageError = "imageType" | "imageSize" | "imageDimensions";

export type ProcessedImage = { ok: true; data: Buffer; width: number; height: number } | { ok: false; error: ImageError };

/**
 * Prüft und normalisiert ein hochgeladenes Bild:
 *  - Größe ≤ 5 MB, Format per Datei-Signatur (JPEG, PNG, WebP)
 *  - Begrenzung der Pixelzahl (Schutz vor Dekompressionsbomben)
 *  - Neukodierung zu WebP, max. 1920 px Kantenlänge, Metadaten (EXIF/GPS) entfernt
 * Die Neukodierung stellt sicher, dass nur echte Bilddaten gespeichert werden.
 */
export async function processImageUpload(file: unknown): Promise<ProcessedImage> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "imageType" };
  if (file.size > IMAGE_MAX_BYTES) return { ok: false, error: "imageSize" };

  const input = Buffer.from(await file.arrayBuffer());
  if (!detectImageKind(input)) return { ok: false, error: "imageType" };

  try {
    const image = sharp(input, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.width || !meta.height) return { ok: false, error: "imageType" };
    if (Math.min(meta.width, meta.height) < IMAGE_MIN_EDGE) return { ok: false, error: "imageDimensions" };

    const { data, info } = await image
      .rotate() // EXIF-Ausrichtung anwenden, bevor Metadaten verworfen werden
      .resize({ width: IMAGE_MAX_EDGE, height: IMAGE_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    return { ok: true, data, width: info.width, height: info.height };
  } catch {
    // Beschädigte Dateien oder zu große Pixelzahl
    return { ok: false, error: "imageType" };
  }
}
