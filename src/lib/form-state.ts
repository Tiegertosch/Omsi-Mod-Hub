import type { z } from "zod";

/** Fehlercodes; die Texte stehen in messages/*.json unter Auth.errors. */
export type FormErrorCode =
  | "validation"
  | "invalid_credentials"
  | "email_not_verified"
  | "banned"
  | "username_taken"
  | "rate_limit"
  | "token_invalid"
  | "current_password_wrong"
  | "unauthorized"
  | "generic";

/** Feldfehler; die Texte stehen unter Auth.fieldErrors. */
export type FieldErrorCode =
  | "username"
  | "email"
  | "password"
  | "passwordConfirm"
  | "acceptTerms"
  | "required"
  | "name"
  | "locale";

export type FormState<E extends string = FormErrorCode, F extends string = FieldErrorCode> =
  | { status: "idle" }
  | { status: "success"; message?: string }
  | {
      status: "error";
      code: E;
      /** Schlüssel ist der Feldpfad, z. B. "email" oder "translations.de.title" */
      fieldErrors?: Record<string, F>;
      /** zuvor eingegebene Werte (niemals Passwörter) */
      values?: Record<string, string>;
    };

export const idleState = { status: "idle" } as const;

/** Erster Fehler pro Feldpfad; der Fehlercode wird über die `message` des Zod-Checks gesetzt. */
export function fieldErrorsFrom<F extends string = FieldErrorCode>(error: z.ZodError): Record<string, F> {
  const result: Record<string, F> = {};
  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".");
    if (field && !(field in result)) result[field] = (issue.message || "required") as F;
  }
  return result;
}
