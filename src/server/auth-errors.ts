import "server-only";

import { APIError } from "better-auth/api";

import type { FormErrorCode } from "@/lib/form-state";

const CODE_MAP: Record<string, FormErrorCode> = {
  INVALID_EMAIL_OR_PASSWORD: "invalid_credentials",
  INVALID_USERNAME_OR_PASSWORD: "invalid_credentials",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "invalid_credentials",
  EMAIL_NOT_VERIFIED: "email_not_verified",
  BANNED_USER: "banned",
  USERNAME_IS_ALREADY_TAKEN: "username_taken",
  INVALID_TOKEN: "token_invalid",
  INVALID_PASSWORD: "current_password_wrong",
  USERNAME_TOO_SHORT: "validation",
  USERNAME_TOO_LONG: "validation",
  INVALID_USERNAME: "validation",
  PASSWORD_TOO_SHORT: "validation",
  PASSWORD_TOO_LONG: "validation",
  INVALID_EMAIL: "validation",
  INVALID_OTP: "code_invalid",
  OTP_EXPIRED: "code_expired",
  TOO_MANY_ATTEMPTS: "code_attempts",
};

/** Übersetzt Better-Auth-Fehler in eigene Codes, ohne interne Details preiszugeben. */
export function mapAuthError(error: unknown): FormErrorCode {
  if (error instanceof APIError) {
    const code = (error.body as { code?: unknown } | undefined)?.code;
    if (typeof code === "string" && code in CODE_MAP) return CODE_MAP[code];
    if (error.status === "TOO_MANY_REQUESTS") return "rate_limit";
    if (error.status === "UNAUTHORIZED") return "unauthorized";
    return "generic";
  }
  console.error("[auth] unerwarteter Fehler:", error instanceof Error ? error.message : "unbekannt");
  return "generic";
}
