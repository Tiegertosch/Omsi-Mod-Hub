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
  | "admin_account"
  | "code_invalid"
  | "code_expired"
  | "code_attempts"
  | "resend_cooldown"
  | "terms_required"
  | "unauthorized"
  | "captcha"
  | "two_factor_expired"
  | "two_factor_locked"
  | "two_factor_active"
  | "session_not_fresh"
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
  | "locale"
  | "emailSame"
  | "confirmUsername"
  | "code"
  | "otp";

export type FormState<E extends string = FormErrorCode, F extends string = FieldErrorCode> =
  | { status: "idle" }
  | {
      status: "success";
      message?: string;
      /** Ab wann (Unix-ms, Serverzeit) die Aktion wieder möglich ist, z. B. „Code erneut senden“ */
      retryAt?: number;
    }
  | {
      status: "error";
      code: E;
      retryAt?: number;
      /** Schlüssel ist der Feldpfad, z. B. "email" oder "translations.de.title" */
      fieldErrors?: Record<string, F>;
      /** zuvor eingegebene Werte (niemals Passwörter) */
      values?: Record<string, string>;
    };

export const idleState = { status: "idle" } as const;

/**
 * Code aus der Ziffern-Eingabe (CodeInput): Jedes Feld heißt `code`, ohne
 * JavaScript kommt jede Ziffer einzeln. Ein einzelnes Textfeld (Backup-Code)
 * liefert genau einen Wert.
 */
export function codeFromForm(formData: FormData, name = "code"): string {
  return formData
    .getAll(name)
    .filter((part): part is string => typeof part === "string")
    .join("");
}

/** Erster Fehler pro Feldpfad; der Fehlercode wird über die `message` des Zod-Checks gesetzt. */
export function fieldErrorsFrom<F extends string = FieldErrorCode>(error: z.ZodError): Record<string, F> {
  const result: Record<string, F> = {};
  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".");
    if (field && !(field in result)) result[field] = (issue.message || "required") as F;
  }
  return result;
}
