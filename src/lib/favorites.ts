/**
 * Regeln der Merkliste und der Mails bei neuen Versionen.
 */

/** Höchstzahl gemerkter Projekte pro Konto. */
export const FAVORITE_LIMIT = 500;

/**
 * Pro Projekt höchstens eine Benachrichtigungsrunde in diesem Zeitraum: Legt
 * ein Creator kurz hintereinander mehrere Versionen an (z. B. Hotfix), kommt
 * nur eine Mail.
 */
export const UPDATE_MAIL_COOLDOWN_HOURS = 6;

/** Länge des Changelog-Auszugs in der Mail. */
export const CHANGELOG_EXCERPT_LENGTH = 600;

/** Changelog für die Mail: Leerzeilen zusammengefasst, an einer Wortgrenze gekürzt. */
export function changelogExcerpt(changelog: string | null | undefined, max = CHANGELOG_EXCERPT_LENGTH): string {
  const text = (changelog ?? "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()} …`;
}
