/**
 * Fassungen der Nutzungsbedingungen, älteste zuerst. Text je Fassung unter
 * content/legal/terms/<version>.<sprache>.md (Deutsch maßgeblich).
 *
 * Neue Fassung veröffentlichen:
 * 1. Datei der letzten Fassung kopieren, als <neue Version>.de.md/.en.md
 *    speichern und anpassen (Zeile „Stand“ = Version).
 * 2. Hier einen Eintrag anhängen: `effectiveFrom` ist das Datum, ab dem die
 *    Fassung bindend gilt; `changes` fasst die Änderungen für das Popup zusammen.
 * 3. Deployen. Angemeldete Nutzer, die der neuesten Fassung noch nicht
 *    zugestimmt haben, sehen das Popup (akzeptieren oder Konto schließen).
 */
export type TermsVersion = {
  /** zugleich Dateiname und gespeicherte Zustimmung (User.termsVersion), Format JJJJ-MM-TT */
  version: string;
  /** ab diesem Tag (Zeitzone Europe/Berlin) bindend, Format JJJJ-MM-TT */
  effectiveFrom: string;
  /** Zusammenfassung der Änderungen für das Popup */
  changes: { de: readonly string[]; en: readonly string[] };
};

export const TERMS_VERSIONS: readonly TermsVersion[] = [
  {
    version: "2026-10-18",
    effectiveFrom: "2026-10-18",
    changes: {
      de: [
        "Erste Fassung der Nutzungsbedingungen für OMSI Mod Hub.",
        "Konten ab 16 Jahren; fremde Projekte nur mit Erlaubnis des Urhebers; kostenpflichtige Projekte müssen gekennzeichnet sein.",
        "Regeln zu Meldungen, Moderation und Sperren sowie zur Haftung für externe Downloads.",
      ],
      en: [
        "First version of the terms of use for OMSI Mod Hub.",
        "Accounts from age 16; other people's projects only with the author's permission; paid projects must be labelled.",
        "Rules on reports, moderation and bans, and on liability for external downloads.",
      ],
    },
  },
];

export const LATEST_TERMS = TERMS_VERSIONS[TERMS_VERSIONS.length - 1];

/** Neueste Fassung – ihr stimmen neue Konten bei der Registrierung zu. */
export const TERMS_VERSION = LATEST_TERMS.version;

export function findTermsVersion(version: string): TermsVersion | null {
  return TERMS_VERSIONS.find((entry) => entry.version === version) ?? null;
}

/** Heutiges Datum als JJJJ-MM-TT in deutscher Zeit (Stichtag für `effectiveFrom`). */
export function berlinDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(now);
}

/** Die am Stichtag geltende Fassung (neueste mit `effectiveFrom` bis heute). */
export function termsInForce(now: Date): TermsVersion {
  const today = berlinDate(now);
  return [...TERMS_VERSIONS].reverse().find((entry) => entry.effectiveFrom <= today) ?? TERMS_VERSIONS[0];
}

/** Bereits veröffentlichte, aber erst später geltende Fassung. */
export function upcomingTerms(now: Date): TermsVersion | null {
  return LATEST_TERMS.effectiveFrom > berlinDate(now) ? LATEST_TERMS : null;
}

/** Ob ein Konto der neuesten Fassung noch zustimmen muss (auch Konten ohne gespeicherte Zustimmung). */
export function needsTermsConsent(acceptedVersion: string | null | undefined): boolean {
  return acceptedVersion !== TERMS_VERSION;
}
