import { execSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { login, randomIp, register, registerAndVerify, uniqueUser, waitForMailLink } from "./helpers";

// Jeder Test erhält eine eigene IP, damit IP-basierte Rate-Limits nicht greifen.
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

test("Registrierung, E-Mail-Bestätigung, Abmeldung und Anmeldung mit Benutzername", async ({ page }) => {
  const user = uniqueUser();
  const since = Date.now() - 1000;
  await register(page, user);

  // Vor der Bestätigung ist keine Anmeldung möglich; es wird ein neuer Link verschickt.
  await login(page, user.email, user.password);
  await expect(page.getByRole("alert").filter({ hasText: "Bitte bestätige zuerst deine E-Mail-Adresse" })).toBeVisible();

  const link = await waitForMailLink(user.email, /bestätige/i, since);
  expect(link).toContain("/api/auth/verify-email");
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "E-Mail bestätigt" })).toBeVisible();

  await page.goto("/de/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Willkommen, ${user.username}!`);

  // Abmelden über das Konto-Menü
  await page.getByRole("button", { name: "Konto" }).click();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/de$/, { timeout: 15_000 });
  await expect(page.getByRole("banner").getByRole("link", { name: "Anmelden" })).toBeVisible();

  // Anmeldung mit Benutzername
  await login(page, user.username, user.password);
  await expect(page).toHaveURL(/\/de\/dashboard$/);
});

test("Geschützte Bereiche leiten zum Login und danach zurück", async ({ page }) => {
  await page.goto("/de/dashboard/settings");
  await expect(page).toHaveURL(/\/de\/login\?next=%2Fde%2Fdashboard%2Fsettings$/);

  await page.goto("/de/admin");
  await expect(page).toHaveURL(/\/de\/login\?next=%2Fde%2Fadmin$/);

  const user = uniqueUser();
  await registerAndVerify(page, user);
  await page.context().clearCookies();
  await page.goto("/de/dashboard/settings");
  await page.getByLabel("E-Mail oder Benutzername").fill(user.email);
  await page.getByLabel("Passwort", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/de\/dashboard\/settings$/);
});

test("Login ignoriert fremde Weiterleitungsziele", async ({ page }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);
  await page.context().clearCookies();
  await page.goto("/de/login?next=https%3A%2F%2Fevil.example%2F");
  await page.getByLabel("E-Mail oder Benutzername").fill(user.email);
  await page.getByLabel("Passwort", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).toHaveURL(/localhost:\d+\/de\/dashboard$/);
});

test("Normale Nutzer erhalten keinen Adminzugang – auch nicht über die API", async ({ page, baseURL }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);

  const response = await page.goto("/de/admin");
  await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
  expect(response?.status()).toBeLessThan(500);

  const headers = { origin: baseURL ?? "", "content-type": "application/json" };
  // Die Anfrage ist authentifiziert (Namensänderung klappt) …
  const ok = await page.request.post("/api/auth/update-user", { headers, data: { name: "Neuer Name" } });
  expect(ok.status()).toBe(200);
  // … aber die Rolle lässt sich weder über update-user noch über Admin-Endpunkte setzen.
  await page.request.post("/api/auth/update-user", { headers, data: { role: "admin" } });
  const setRole = await page.request.post("/api/auth/admin/set-role", {
    headers,
    data: { userId: "irrelevant", role: "admin" },
  });
  expect(setRole.status()).toBeGreaterThanOrEqual(400);

  await page.goto("/de/dashboard");
  await expect(page.getByText("Mitglied", { exact: true })).toBeVisible();
  await page.goto("/de/admin");
  await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
});

test("Admin-Rolle per CLI: Adminbereich wird sichtbar", async ({ page }) => {
  const user = uniqueUser("e2e-admin");
  await registerAndVerify(page, user);

  execSync(`pnpm user:set-role ${user.email} admin`, { stdio: "pipe" });

  await page.goto("/de/admin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Administration");
  await expect(page.getByText("Veröffentlichte Projekte")).toBeVisible();
  await page.getByRole("button", { name: "Konto" }).click();
  await expect(page.getByRole("link", { name: "Administration" })).toBeVisible();
});

test("Registrierung prüft Eingaben serverseitig", async ({ page }) => {
  await page.goto("/de/register");
  await page.getByLabel("Benutzername").fill("ungültig name");
  await page.getByLabel("E-Mail-Adresse").fill("keine-mail");
  await page.getByLabel("Passwort", { exact: true }).fill("kurz");
  await page.getByLabel("Passwort wiederholen").fill("anders");
  await page.getByRole("button", { name: "Konto erstellen" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Bitte prüfe die markierten Felder" })).toBeVisible();
  await expect(page.getByLabel("Benutzername")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("E-Mail-Adresse")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Passwort", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Bitte bestätige, dass du die Nutzungsbedingungen gelesen hast.")).toBeVisible();
  // Eingaben (außer Passwörtern) bleiben erhalten
  await expect(page.getByLabel("E-Mail-Adresse")).toHaveValue("keine-mail");

  // Vergebener Benutzername
  const user = uniqueUser();
  await page.getByLabel("Benutzername").fill("elbtal-busworks");
  await page.getByLabel("E-Mail-Adresse").fill(user.email);
  await page.getByLabel("Passwort", { exact: true }).fill(user.password);
  await page.getByLabel("Passwort wiederholen").fill(user.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Benutzername ist bereits vergeben" })).toBeVisible();
});

test("Passwort zurücksetzen per E-Mail-Link", async ({ page }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);
  await page.context().clearCookies();

  const since = Date.now() - 1000;
  await page.goto("/de/forgot-password");
  await page.getByLabel("E-Mail-Adresse").fill(user.email);
  await page.getByRole("button", { name: "Link anfordern" }).click();
  await expect(page.getByRole("status")).toContainText("Falls ein Konto");

  const link = await waitForMailLink(user.email, /zurücksetzen/i, since);
  await page.goto(link);
  await expect(page).toHaveURL(/\/de\/reset-password\?token=/);
  const newPassword = "Neues-E2E-Passwort-1";
  await page.getByLabel("Neues Passwort").fill(newPassword);
  await page.getByLabel("Passwort wiederholen").fill(newPassword);
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page.getByRole("status")).toContainText("Dein Passwort wurde geändert");

  await login(page, user.email, user.password);
  await expect(page.getByRole("alert").filter({ hasText: "Passwort ist falsch" })).toBeVisible();
  await login(page, user.email, newPassword);
  await expect(page).toHaveURL(/\/de\/dashboard$/);
});

test("Einstellungen: Anzeigename, Sprache und Passwort", async ({ page }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);

  await page.goto("/de/dashboard/settings");
  await page.getByLabel("Anzeigename").fill("Busfahrerin Test");
  await page.getByLabel("Bevorzugte Sprache").selectOption("en");
  await page.getByRole("button", { name: "Profil speichern" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/settings$/);
  await expect(page.getByLabel("Display name")).toHaveValue("Busfahrerin Test");

  await page.getByLabel("Current password").fill("falsch-falsch-falsch");
  await page.getByLabel("New password", { exact: true }).fill("Noch-ein-Passwort-9");
  await page.getByLabel("Repeat new password").fill("Noch-ein-Passwort-9");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "current password is incorrect" })).toBeVisible();

  await page.getByLabel("Current password").fill(user.password);
  await page.getByLabel("New password", { exact: true }).fill("Noch-ein-Passwort-9");
  await page.getByLabel("Repeat new password").fill("Noch-ein-Passwort-9");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("status")).toContainText("Your password has been changed");
});
