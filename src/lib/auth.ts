import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, emailOTP, username } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";

import {
  changeEmailConfirmationEmail,
  changeEmailVerificationEmail,
  resetPasswordEmail,
  verificationCodeEmail,
} from "@/server/emails";
import { sendMailInBackground } from "@/server/mail";

import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_PATTERN,
  VERIFICATION_CODE_ATTEMPTS,
  VERIFICATION_CODE_LENGTH,
  VERIFICATION_CODE_MINUTES,
} from "./auth-rules";
import { db } from "./db";
import { TERMS_VERSION } from "./legal";
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
  // Registrierung und Anmeldung bestätigen per Code (Plugin emailOTP, siehe unten);
  // die Server Actions verschicken ihn selbst. Links gibt es nur noch für
  // Schritt 2 der E-Mail-Änderung.
  emailVerification: {
    sendOnSignUp: false,
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      // Nur bei einer E-Mail-Änderung: Das Konto ist bestätigt und `user.email`
      // enthält schon die neue Adresse.
      if (!user.emailVerified) return;
      sendMailInBackground(changeEmailVerificationEmail(user, url));
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
      termsVersion: { type: "string", required: false, input: false },
      termsAcceptedAt: { type: "date", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  // Nur über Server Actions erreichbar (auth.api.* ist davon nicht betroffen):
  // Dort gelten Passwortabfrage, Validierung und eigene Limits. "/list-sessions"
  // würde die Session-Tokens aller Geräte an den Browser ausliefern. Vom
  // emailOTP-Plugin wird nur die Bestätigung nach der Registrierung genutzt;
  // Anmeldung, Passwort-Reset und E-Mail-Änderung per Code bleiben aus.
  disabledPaths: [
    "/change-email",
    "/update-user",
    "/list-sessions",
    // Registrierung nur über das Formular: Dort ist die Zustimmung zu den Nutzungsbedingungen Pflicht.
    "/sign-up/email",
    "/send-verification-email",
    "/email-otp/send-verification-otp",
    "/email-otp/check-verification-otp",
    "/email-otp/verify-email",
    "/sign-in/email-otp",
    "/email-otp/request-password-reset",
    "/forget-password/email-otp",
    "/email-otp/reset-password",
    "/email-otp/request-email-change",
    "/email-otp/change-email",
  ],
  // Gilt für alle HTTP-Anfragen an /api/auth/*. Server Actions haben eigene Limits.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": RATE_LIMIT_STRICT,
      "/sign-in/username": RATE_LIMIT_STRICT,
      "/request-password-reset": { window: 60 * 60, max: 3 },
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
          // Konten entstehen nur über registerAction (Checkbox ist Pflicht, die
          // HTTP-Registrierung ist gesperrt) – deshalb hier die Zustimmung festhalten.
          return { data: { ...user, termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() } };
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
    emailOTP({
      otpLength: VERIFICATION_CODE_LENGTH,
      expiresIn: VERIFICATION_CODE_MINUTES * 60,
      allowedAttempts: VERIFICATION_CODE_ATTEMPTS,
      // In der Datenbank nur als Hash; ein erneutes Senden erzeugt einen neuen Code.
      storeOTP: "hashed",
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "email-verification") return;
        // Bestätigte Konten bekommen keinen Code: Eine Registrierung mit einer
        // vergebenen Adresse antwortet gleich, verschickt aber nichts.
        const user = await db.user.findUnique({
          where: { email },
          select: { email: true, name: true, preferredLocale: true, emailVerified: true },
        });
        if (!user || user.emailVerified) return;
        sendMailInBackground(verificationCodeEmail(user, otp, VERIFICATION_CODE_MINUTES));
      },
    }),
    // Muss das letzte Plugin sein: setzt Cookies bei Aufrufen aus Server Actions.
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
