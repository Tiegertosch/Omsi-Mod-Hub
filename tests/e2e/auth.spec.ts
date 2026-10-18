import { execSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import {
  codeFields,
  enterCode,
  login,
  randomIp,
  register,
  registerAndVerify,
  uniqueUser,
  waitForMail,
  waitForMailCode,
  waitForMailLink,
} from "./helpers";

// Jeder Test erhält eine eigene IP, damit IP-basierte Rate-Limits nicht greifen.
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

test("Registrierung, E-Mail-Bestätigung, Abmeldung und Anmeldung mit Benutzername", async ({ page }) => {
  const user = uniqueUser();
  const since = Date.now() - 1000;
  await register(page, user);

  await expect(page.getByRole("navigation", { name: "Fortschritt der Registrierung" }).locator("[aria-current=step]")).toHaveText("2");
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();
  const firstCode = await waitForMailCode(user.email, since);
  // Die Mail enthält nur den Code und einen Link zur Eingabeseite, keinen Bestätigungslink.
  const mail = await waitForMail(user.email, /Bestätigungscode/, since);
  expect(mail.text).not.toContain("/api/auth/verify-email");
  expect(mail.text).toContain("/de/confirm-email");

  // Falscher Code
  await enterCode(page, firstCode === "000000" ? "111111" : "000000");
  await expect(page.getByRole("alert").filter({ hasText: "Der Code ist falsch" })).toBeVisible();

  // Vor der Bestätigung ist keine Anmeldung möglich: Weiterleitung zur Code-Seite mit neuem Code.
  const beforeLogin = Date.now() - 500;
  await login(page, user.username, user.password);
  await expect(page).toHaveURL(/\/de\/confirm-email\?unverified=1$/);
  await expect(page.getByText("Dein Konto ist noch nicht bestätigt.")).toBeVisible();
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();
  const loginCode = await waitForMailCode(user.email, beforeLogin);

  // Der neue Code ersetzt den alten.
  await enterCode(page, loginCode === firstCode ? "000000" : firstCode);
  await expect(page.getByRole("alert").filter({ hasText: "Der Code ist falsch" })).toBeVisible();
  await enterCode(page, loginCode);
  await expect(page).toHaveURL(/\/de\/dashboard$/);
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
  // Die Anfragen sind authentifiziert …
  const session = await page.request.get("/api/auth/get-session", { headers });
  expect(((await session.json()) as { user?: { email?: string } } | null)?.user?.email).toBe(user.email);
  // … aber die Rolle lässt sich weder über update-user (über HTTP gesperrt) noch über Admin-Endpunkte setzen.
  const updateUser = await page.request.post("/api/auth/update-user", { headers, data: { role: "admin" } });
  expect(updateUser.status()).toBe(404);
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

  // „Current password“ steht auch in den Formularen für E-Mail und Löschen.
  const passwordSection = page.getByRole("region", { name: "Change password" });
  await passwordSection.getByLabel("Current password").fill("falsch-falsch-falsch");
  await passwordSection.getByLabel("New password", { exact: true }).fill("Noch-ein-Passwort-9");
  await passwordSection.getByLabel("Repeat new password").fill("Noch-ein-Passwort-9");
  await passwordSection.getByRole("button", { name: "Change password" }).click();
  await expect(passwordSection.getByRole("alert").filter({ hasText: "current password is incorrect" })).toBeVisible();

  await passwordSection.getByLabel("Current password").fill(user.password);
  await passwordSection.getByLabel("New password", { exact: true }).fill("Noch-ein-Passwort-9");
  await passwordSection.getByLabel("Repeat new password").fill("Noch-ein-Passwort-9");
  await passwordSection.getByRole("button", { name: "Change password" }).click();
  await expect(passwordSection.getByRole("status")).toContainText("Your password has been changed");
});

test("Bestätigungscode erneut senden: neuer Code ersetzt den alten, Wartezeit dazwischen", async ({ page }) => {
  const user = uniqueUser();
  const since = Date.now() - 1000;
  await register(page, user);
  const firstCode = await waitForMailCode(user.email, since);

  const beforeResend = Date.now() - 500;
  await page.getByRole("button", { name: "Code erneut senden" }).click();
  await expect(page.getByRole("status").filter({ hasText: "neuen Code geschickt" })).toBeVisible();
  const secondCode = await waitForMailCode(user.email, beforeResend);

  // Sofort noch einmal: Wartezeit
  await page.getByRole("button", { name: "Code erneut senden" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Bitte warte eine Minute" })).toBeVisible();

  if (firstCode !== secondCode) {
    await enterCode(page, firstCode);
    await expect(page.getByRole("alert").filter({ hasText: "Der Code ist falsch" })).toBeVisible();
  }
  // Leerzeichen in kopierten Codes werden ignoriert.
  await enterCode(page, `${secondCode.slice(0, 3)} ${secondCode.slice(3)}`);
  await expect(page).toHaveURL(/\/de\/dashboard$/);
});

test("Nach zu vielen falschen Eingaben ist ein neuer Code nötig", async ({ page }) => {
  const user = uniqueUser();
  const since = Date.now() - 1000;
  await register(page, user);
  const code = await waitForMailCode(user.email, since);
  const wrong = code === "000000" ? "111111" : "000000";

  for (let attempt = 0; attempt < 5; attempt++) {
    await enterCode(page, wrong);
    // Die Meldung steht schon vom vorigen Versuch da; erst das Zurücksetzen des
    // Formulars zeigt, dass dieser Versuch verarbeitet wurde.
    await expect(codeFields(page).first()).toHaveValue("");
    await expect(page.getByRole("alert").filter({ hasText: "Der Code ist falsch" })).toBeVisible();
  }
  await enterCode(page, code);
  await expect(page.getByRole("alert").filter({ hasText: "Zu viele falsche Eingaben" })).toBeVisible();

  const beforeResend = Date.now() - 500;
  await page.getByRole("button", { name: "Code erneut senden" }).click();
  await enterCode(page, await waitForMailCode(user.email, beforeResend));
  await expect(page).toHaveURL(/\/de\/dashboard$/);
});

test("Registrierung mit vergebener Adresse sieht gleich aus, verschickt aber keinen Code", async ({ page, browser }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);

  const other = await browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const otherPage = await other.newPage();
  // Ohne Puffer: Die Code-Mail der ersten Registrierung ist sicher älter (registerAndVerify wartet auf das
  // Dashboard). Mit Puffer wurde sie bei schnellem Durchlauf mitgezählt.
  const since = Date.now();
  await register(otherPage, { ...uniqueUser(), email: user.email });
  await expect(otherPage.getByText(user.email, { exact: true })).toBeVisible();
  await expect(waitForMail(user.email, /Bestätigungscode/, since, 3_000)).rejects.toThrow();
  await other.close();
});

test("Code Ziffer für Ziffer eintippen: Fokus springt weiter, Rücktaste zurück", async ({ page }) => {
  const user = uniqueUser();
  const since = Date.now() - 1000;
  await register(page, user);
  const code = await waitForMailCode(user.email, since);
  const fields = codeFields(page);
  await expect(fields).toHaveCount(6);

  // Das erste Feld hat den Fokus; ein Tippfehler wird mit der Rücktaste korrigiert.
  await page.keyboard.type(code.slice(0, 3));
  await page.keyboard.type("9");
  await page.keyboard.press("Backspace");
  await expect(fields.nth(3)).toHaveValue("");
  await page.keyboard.press("Backspace");
  await expect(fields.nth(2)).toHaveValue("");
  await page.keyboard.type(code.slice(2));
  for (let index = 0; index < 6; index++) await expect(fields.nth(index)).toHaveValue(code[index]);

  await page.getByRole("button", { name: "Bestätigen", exact: true }).click();
  await expect(page).toHaveURL(/\/de\/dashboard$/);
});

test("E-Mail-Adresse bearbeiten: zurück zu Schritt 1, Code an die neue Adresse", async ({ page }) => {
  const user = uniqueUser();
  const wrongEmail = `${user.username}-tippfehler@e2e.example.com`;
  await register(page, { ...user, email: wrongEmail });
  await expect(page.getByText(wrongEmail, { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "E-Mail-Adresse bearbeiten" }).click();
  await expect(page).toHaveURL(/\/de\/register\?edit=1$/);
  await expect(page.getByRole("navigation", { name: "Fortschritt der Registrierung" }).locator("[aria-current=step]")).toHaveText("1");
  await expect(page.getByLabel("Benutzername")).toHaveValue(user.username);
  await expect(page.getByLabel("E-Mail-Adresse")).toHaveValue(wrongEmail);

  // Falsches Passwort: Das Konto bleibt unverändert, der Name gilt als vergeben.
  await page.getByLabel("E-Mail-Adresse").fill(user.email);
  await page.getByLabel("Passwort", { exact: true }).fill("Ganz-anderes-Passwort-1");
  await page.getByLabel("Passwort wiederholen").fill("Ganz-anderes-Passwort-1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Benutzername ist bereits vergeben" })).toBeVisible();

  const since = Date.now() - 500;
  await page.getByLabel("E-Mail-Adresse").fill(user.email);
  await page.getByLabel("Passwort", { exact: true }).fill(user.password);
  await page.getByLabel("Passwort wiederholen").fill(user.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page).toHaveURL(/\/de\/confirm-email$/);
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();

  await enterCode(page, await waitForMailCode(user.email, since));
  await expect(page).toHaveURL(/\/de\/dashboard$/);

  // Das Konto läuft jetzt auf die neue Adresse.
  await page.goto("/de/dashboard/settings");
  await expect(page.getByLabel("Aktuelle Adresse")).toHaveValue(user.email);
});

test("Code-Seite auf einem anderen Gerät: Adresse eingeben", async ({ page, browser }) => {
  const user = uniqueUser();
  const since = Date.now() - 1000;
  await register(page, user);
  const code = await waitForMailCode(user.email, since);

  const other = await browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const otherPage = await other.newPage();
  await otherPage.goto("/de/confirm-email");
  await expect(otherPage.getByRole("link", { name: "E-Mail-Adresse bearbeiten" })).toHaveCount(0);
  await otherPage.getByLabel("E-Mail-Adresse").fill(user.email);
  await enterCode(otherPage, code);
  await expect(otherPage).toHaveURL(/\/de\/dashboard$/);
  await other.close();
});
