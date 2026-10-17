import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";

import {
  changeEmailConfirmationEmail,
  changeEmailVerificationEmail,
  resetPasswordEmail,
  verificationEmail,
} from "@/server/emails";
import { sendMailInBackground } from "@/server/mail";

import { PASSWORD_MAX, PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN, USERNAME_PATTERN } from "./auth-rules";
import { db } from "./db";
import { siteConfig } from "./site";

/**
 * Rollen: "user" (Standard), "creator", "admin". Nur "admin" darf die
 * Admin-Endpunkte von Better Auth nutzen. Die Rolle ist kein Eingabefeld –
 * sie kann weder bei der Registrierung noch über update-user gesetzt werden.
 */
const ac = createAccessControl(defaultStatements);
const roles = {
  user: userAc,
  creator: ac.newRole({ user: [], session: [] }),
  admin: adminAc,
};

const RATE_LIMIT_STRICT = { window: 60, max: 5 };

export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: process.env.BETTER_AUTH_URL ?? siteConfig.url,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  advanced: {
    // IDs vergibt die Datenbank (cuid), wie im übrigen Schema.
    database: { generateId: false },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: PASSWORD_MIN,
    maxPasswordLength: PASSWORD_MAX,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      sendMailInBackground(resetPasswordEmail(user, url));
    },
    // Antwort bei bereits registrierter E-Mail muss wie eine echte Registrierung aussehen.
    customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
      ...coreFields,
      role: "user",
      banned: false,
      banReason: null,
      banExpires: null,
      ...additionalFields,
      id,
    }),
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      // Bei einer E-Mail-Änderung ist das Konto schon bestätigt und `user.email`
      // enthält die neue Adresse; Registrierung und Anmeldung betreffen nur
      // unbestätigte Konten.
      sendMailInBackground(user.emailVerified ? changeEmailVerificationEmail(user, url) : verificationEmail(user, url));
    },
  },
  user: {
    // Zweistufig: erst Bestätigung über die bisherige, dann über die neue Adresse.
    // Ist die neue Adresse vergeben, antwortet Better Auth gleich, verschickt aber nichts.
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        sendMailInBackground(changeEmailConfirmationEmail(user, newEmail, url));
      },
    },
    // deleteUser bleibt deaktiviert: Das Löschen übernimmt eine eigene Server
    // Action, weil Projekte und Bilder mit entfernt werden müssen.
    additionalFields: {
      preferredLocale: { type: "string", required: false, input: true },
      isSample: { type: "boolean", required: false, input: false, defaultValue: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  // Nur über Server Actions erreichbar (auth.api.* ist davon nicht betroffen):
  // Dort gelten Passwortabfrage, Validierung und eigene Limits. "/list-sessions"
  // würde die Session-Tokens aller Geräte an den Browser ausliefern.
  disabledPaths: ["/change-email", "/update-user", "/list-sessions"],
  // Gilt für alle HTTP-Anfragen an /api/auth/*. Server Actions haben eigene Limits.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": RATE_LIMIT_STRICT,
      "/sign-in/username": RATE_LIMIT_STRICT,
      "/sign-up/email": { window: 60 * 60, max: 5 },
      "/request-password-reset": { window: 60 * 60, max: 3 },
      "/send-verification-email": { window: 60 * 60, max: 3 },
      "/reset-password": RATE_LIMIT_STRICT,
      "/change-password": RATE_LIMIT_STRICT,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Jedes Konto braucht einen Benutzernamen (öffentliche Profil-URL).
          if (typeof user.username !== "string" || user.username.length === 0) {
            throw new APIError("BAD_REQUEST", { message: "USERNAME_REQUIRED" });
          }
        },
      },
    },
  },
  plugins: [
    username({
      minUsernameLength: USERNAME_MIN,
      maxUsernameLength: USERNAME_MAX,
      usernameValidator: (value) => USERNAME_PATTERN.test(value),
      // Benutzernamen erscheinen in URLs (/creators/[username]) und bleiben stabil.
      immutableUsername: true,
    }),
    admin({ ac, roles, defaultRole: "user", adminRoles: ["admin"] }),
    // Muss das letzte Plugin sein: setzt Cookies bei Aufrufen aus Server Actions.
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
