import { defineConfig, devices } from "@playwright/test";

// Muss zu BETTER_AUTH_URL passen, damit Links aus E-Mails auf den Testserver zeigen.
const PORT = Number(process.env.E2E_PORT ?? 3000);

/**
 * End-to-End-Tests gegen den Produktionsbuild.
 * Voraussetzungen: `pnpm build`, migrierte und geseedete Datenbank,
 * MAIL_TRANSPORT="file" (Mails werden aus ./.dev-mail gelesen).
 * Testkonten (@e2e.example.com) werden nach dem Lauf entfernt; der
 * Meldungs-Test legt einen Report in der Entwicklungsdatenbank an.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Ein lokaler Server bedient alle Worker; Passwort-Hashing (scrypt) ist absichtlich
  // rechenintensiv. Mehr Worker führen zu Wartezeiten statt zu schnelleren Läufen.
  workers: process.env.CI ? 2 : 4,
  // Ablauf-Tests mit mehreren Konten (Registrierung, Projekt, Freigabe, Moderation)
  // brauchen unter paralleler Last 15–25 s; direkt nach einem Build erneuert der
  // Server zusätzlich alle vorgerenderten Seiten im Hintergrund.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "de-DE",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/de`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { MAIL_TRANSPORT: "file" },
  },
});
