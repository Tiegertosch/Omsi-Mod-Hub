/** Grenzwerte für Projektdaten – gelten in Formularen und serverseitig. */
export const PROJECT_LIMITS = {
  title: 100,
  summary: 200,
  description: 20_000,
  installation: 10_000,
  license: 300,
  gameCompatibility: 80,
  imageAlt: 150,
  tags: 8,
  contributors: 10,
  contributorName: 60,
  contributorRole: 60,
  requirements: 15,
  requirementName: 80,
  screenshots: 12,
  version: 32,
  changelog: 5_000,
  linksPerVersion: 5,
  linkLabel: 60,
  versions: 100,
  moderationNote: 1_000,
} as const;

/** Versionsbezeichnung, z. B. "1.2.0", "2.0-beta", "v3 Winter". */
export const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+_ -]*$/;

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_MAX_EDGE = 1920;
export const IMAGE_MIN_EDGE = 320;
/** Schutz vor „Dekompressionsbomben“ (sehr große Pixelzahl bei kleiner Datei). */
export const IMAGE_MAX_INPUT_PIXELS = 40_000_000;

/** Ob neue oder geänderte Einreichungen eine Admin-Freigabe brauchen (Standard: ja). */
export function isReviewRequired(): boolean {
  return process.env.PROJECT_REVIEW_REQUIRED !== "false";
}
