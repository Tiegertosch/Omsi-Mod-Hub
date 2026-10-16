import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { MEDIA_KEY_PATTERN } from "@/lib/image-signature";

/**
 * Ablage hochgeladener Medien im lokalen Dateisystem (UPLOAD_DIR, Standard
 * ./storage/uploads). Bewusst außerhalb von /public: Next.js liefert dort nur
 * Dateien aus, die beim Build vorhanden waren. Ausgeliefert wird über /media/[key].
 * Für mehrere Server-Instanzen ist ein gemeinsamer Objektspeicher (z. B. S3) nötig.
 */
// Laufzeit-Verzeichnis: vom Build-Tracing ausnehmen (turbopackIgnore), sonst würde das ganze Projekt gebündelt.
const UPLOAD_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "uploads"),
);

function pathForKey(key: string) {
  // Schlüssel sind streng geprüft – kein Pfad kann das Upload-Verzeichnis verlassen.
  if (!MEDIA_KEY_PATTERN.test(key)) throw new Error("Ungültiger Medien-Schlüssel.");
  return path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, key);
}

export async function storeMedia(data: Buffer): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const key = `${randomBytes(16).toString("hex")}.webp`;
  await writeFile(pathForKey(key), data, { flag: "wx" });
  return key;
}

export async function readMedia(key: string): Promise<Buffer | null> {
  try {
    return await readFile(pathForKey(key));
  } catch {
    return null;
  }
}

export async function deleteMedia(key: string | null): Promise<void> {
  if (!key) return;
  try {
    await unlink(pathForKey(key));
  } catch {
    // Datei existiert nicht (mehr) – nichts zu tun.
  }
}
