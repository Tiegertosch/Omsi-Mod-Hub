/** Gemeinsame Regeln für Konten – gelten in Formularen und in Better Auth. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;
/** Vor der Normalisierung (Kleinschreibung) geprüft. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export const DISPLAY_NAME_MAX = 50;

/** Bestätigungscode nach der Registrierung */
export const VERIFICATION_CODE_LENGTH = 6;
export const VERIFICATION_CODE_MINUTES = 15;
/** Falsche Eingaben pro Code, danach muss ein neuer angefordert werden */
export const VERIFICATION_CODE_ATTEMPTS = 5;
