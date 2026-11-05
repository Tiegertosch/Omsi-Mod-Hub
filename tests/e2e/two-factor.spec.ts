import { execSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

import {
  E2E_MAIL_DOMAIN,
  enableTwoFactor,
  fillDigits,
  login,
  randomIp,
  registerAndVerify,
  totp,
  uniqueUser,
  waitForMail,
  waitForMailLink,
} from "./helpers";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

/** Ein Code, der garantiert nicht der aktuelle ist (auch nicht im Nachbarfenster). */
function wrongCode(secret: string) {
  const valid = new Set([-30_000, 0, 30_000].map((offset) => totp(secret, Date.now() + offset)));
  for (let i = 0; ; i++) {
    const candidate = String(i).padStart(6, "0");
    if (!valid.has(candidate)) return candidate;
  }
}

/** App-Code in die Ziffernfelder, Backup-Code ins Textfeld – je nach angezeigtem Modus. */
async function submitSecondFactor(page: Page, code: string) {
  // Erst die Code-Seite abwarten; isVisible() unten wartet nicht.
  await expect(page.getByRole("heading", { name: "Zweiter Faktor" })).toBeVisible();
  const digits = page.getByRole("group", { name: "Code aus der App" });
  if (await digits.isVisible()) await fillDigits(page, "Code aus der App", code);
  else await page.getByLabel("Backup-Code").fill(code);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
}

test("2FA einrichten, Anmeldung mit App- und Backup-Code, Abschalten", async ({ page }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);
  const since = Date.now() - 1000;
  const { secret, backupCodes } = await enableTwoFactor(page, user.password);
  expect(backupCodes).toHaveLength(10);
  await waitForMail(user.email, /Zwei-Faktor-Anmeldung eingeschaltet/, since);

  // Nach dem Passwort fragt die Anmeldung den zweiten Faktor ab.
  await page.context().clearCookies();
  await login(page, user.email, user.password);
  await expect(page).toHaveURL(/\/de\/login\/two-factor$/);
  await expect(page.getByRole("heading", { name: "Zweiter Faktor" })).toBeVisible();
  // Ohne zweiten Faktor gibt es keine Session.
  await page.goto("/de/dashboard");
  await expect(page).toHaveURL(/\/de\/login\?next=/);
  await page.goto("/de/login/two-factor");

  await submitSecondFactor(page, "12");
  await expect(page.getByText("Bitte gib den 6-stelligen Code aus der App")).toBeVisible();
  await submitSecondFactor(page, wrongCode(secret));
  await expect(page.getByRole("alert").filter({ hasText: "Der Code ist falsch" })).toBeVisible();
  await submitSecondFactor(page, totp(secret));
  await expect(page).toHaveURL(/\/de\/dashboard$/);

  // Backup-Code funktioniert genau einmal.
  for (const [index, expectOk] of [
    [0, true],
    [0, false],
    [1, true],
  ] as const) {
    await page.context().clearCookies();
    await login(page, user.username, user.password);
    await expect(page).toHaveURL(/\/de\/login\/two-factor$/);
    await page.getByRole("link", { name: /Backup-Code verwenden/ }).click();
    await expect(page.getByLabel("Backup-Code")).toBeVisible();
    await submitSecondFactor(page, backupCodes[index]);
    if (expectOk) await expect(page).toHaveURL(/\/de\/dashboard$/);
    else await expect(page.getByRole("alert").filter({ hasText: "Der Code ist falsch" })).toBeVisible();
  }

  await page.goto("/de/dashboard/settings/security");
  const section = page.getByRole("region", { name: "Zwei-Faktor-Anmeldung" });
  await expect(section.getByText("Noch 8 unbenutzte Backup-Codes.")).toBeVisible();

  // Abschalten verlangt Passwort und Code.
  const disableSince = Date.now() - 1000;
  const disable = section.locator("details", { hasText: "Zwei-Faktor-Anmeldung abschalten" });
  await disable.getByText("Zwei-Faktor-Anmeldung abschalten").click();
  await disable.getByLabel("Aktuelles Passwort").fill(user.password);
  await fillDigits(disable, "Code aus der App", wrongCode(secret));
  await disable.getByRole("button", { name: "Abschalten" }).click();
  await expect(disable.getByRole("alert")).toContainText("Der Code ist falsch");
  await disable.getByLabel("Aktuelles Passwort").fill(user.password);
  await fillDigits(disable, "Code aus der App", totp(secret));
  await disable.getByRole("button", { name: "Abschalten" }).click();
  await expect(section.getByRole("button", { name: "Zwei-Faktor-Anmeldung einrichten" })).toBeVisible();
  await waitForMail(user.email, /Zwei-Faktor-Anmeldung abgeschaltet/, disableSince);

  await page.context().clearCookies();
  await login(page, user.email, user.password);
  await expect(page).toHaveURL(/\/de\/dashboard$/);
});

test("Neue Backup-Codes ersetzen die alten; Notfall-Skript schaltet 2FA ab", async ({ page }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);
  const { backupCodes: oldCodes } = await enableTwoFactor(page, user.password);

  const section = page.getByRole("region", { name: "Zwei-Faktor-Anmeldung" });
  const regenerate = section.locator("details", { hasText: "Neue Backup-Codes erzeugen" });
  await regenerate.locator("summary").click();
  await regenerate.getByLabel("Aktuelles Passwort").fill(user.password);
  await regenerate.locator("form").getByRole("button", { name: "Neue Backup-Codes erzeugen" }).click();
  await expect(regenerate.getByText("Die bisherigen gelten nicht mehr.")).toBeVisible();
  const newCodes = await regenerate.getByRole("list", { name: "Backup-Codes" }).getByRole("listitem").allTextContents();
  expect(newCodes).toHaveLength(10);
  expect(newCodes).not.toContain(oldCodes[0]);

  for (const [code, expectOk] of [
    [oldCodes[0], false],
    [newCodes[0], true],
  ] as const) {
    await page.context().clearCookies();
    await login(page, user.email, user.password);
    await page.getByRole("link", { name: /Backup-Code verwenden/ }).click();
    await expect(page.getByLabel("Backup-Code")).toBeVisible();
    await submitSecondFactor(page, code);
    if (expectOk) await expect(page).toHaveURL(/\/de\/dashboard$/);
    else await expect(page.getByRole("alert").filter({ hasText: "Der Code ist falsch" })).toBeVisible();
  }

  // Notfall: App und Codes verloren → CLI schaltet ab und meldet alle Geräte ab.
  execSync(`pnpm user:disable-2fa ${user.email}`, { stdio: "pipe" });
  await page.goto("/de/dashboard");
  await expect(page).toHaveURL(/\/de\/login\?next=/);
  await login(page, user.email, user.password);
  await expect(page).toHaveURL(/\/de\/dashboard$/);
});

test("Einrichten meldet andere Geräte ab", async ({ page, browser }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);
  const other = await browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const otherPage = await other.newPage();
  await login(otherPage, user.email, user.password);
  await expect(otherPage).toHaveURL(/\/de\/dashboard$/);

  await enableTwoFactor(page, user.password);
  await otherPage.goto("/de/dashboard");
  await expect(otherPage).toHaveURL(/\/de\/login\?next=/);
  // Das einrichtende Gerät bleibt angemeldet.
  await page.goto("/de/dashboard");
  await expect(page).toHaveURL(/\/de\/dashboard$/);
  await other.close();
});

test("Admins ohne 2FA landen bei der Einrichtung, danach ist der Adminbereich offen", async ({ page }) => {
  const user = uniqueUser("e2e-admin");
  await registerAndVerify(page, user);
  execSync(`pnpm user:set-role ${user.email} admin`, { stdio: "pipe" });

  await page.goto("/de/admin");
  await expect(page).toHaveURL(/\/de\/dashboard\/settings\/security\?twoFactor=required/);
  await expect(page.getByText("Der Adminbereich ist erst mit Zwei-Faktor-Anmeldung zugänglich.")).toBeVisible();

  await enableTwoFactor(page, user.password);
  await page.goto("/de/admin");
  await expect(page).toHaveURL(/\/de\/admin$/);
  await expect(page.getByRole("navigation", { name: "Adminbereich" })).toBeVisible();
});

test("Bestätigungslink der E-Mail-Änderung meldet Konten mit 2FA nicht an", async ({ page, browser }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);
  const { secret } = await enableTwoFactor(page, user.password);
  const newEmail = `${user.username}-neu@${E2E_MAIL_DOMAIN}`;

  const since = Date.now() - 1000;
  await page.goto("/de/dashboard/settings/account");
  const section = page.getByRole("region", { name: "E-Mail-Adresse" });
  await section.getByLabel("Neue E-Mail-Adresse").fill(newEmail);
  await section.getByLabel("Aktuelles Passwort").fill(user.password);
  await section.getByRole("button", { name: "E-Mail-Adresse ändern" }).click();
  await page.goto(await waitForMailLink(user.email, /ändern/i, since));
  const verifyLink = await waitForMailLink(newEmail, /neue E-Mail-Adresse bestätigen/i, since);

  // Ohne Session: kein automatisches Anmelden, die Adresse bleibt unverändert.
  const fresh = await browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const freshPage = await fresh.newPage();
  await freshPage.goto(verifyLink);
  await expect(freshPage).toHaveURL(/\/de\/verify-email\?error=LOGIN_REQUIRED$/);
  await expect(freshPage.getByText("Melde dich bitte zuerst an")).toBeVisible();
  await freshPage.goto("/de/dashboard");
  await expect(freshPage).toHaveURL(/\/de\/login\?next=/);

  // Angemeldet (mit zweitem Faktor) übernimmt derselbe Link die neue Adresse.
  await login(freshPage, user.email, user.password);
  await submitSecondFactor(freshPage, totp(secret));
  await expect(freshPage).toHaveURL(/\/de\/dashboard$/);
  await freshPage.goto(verifyLink);
  await freshPage.goto("/de/dashboard/settings/account");
  await expect(freshPage.getByRole("region", { name: "E-Mail-Adresse" }).getByLabel("Aktuelle Adresse")).toHaveValue(newEmail);
  await fresh.close();
});

test("HTTP-Endpunkte für 2FA und Admin-Plugin sind gesperrt", async ({ request, baseURL }) => {
  // Mit gültiger Origin, damit nicht schon die Origin-Prüfung von Better Auth greift.
  const origin = new URL(baseURL ?? "http://localhost").origin;
  for (const path of [
    "/api/auth/two-factor/enable",
    "/api/auth/two-factor/verify-totp",
    "/api/auth/two-factor/disable",
    "/api/auth/admin/set-role",
    "/api/auth/admin/impersonate-user",
  ]) {
    const response = await request.post(path, { data: {}, headers: { origin } });
    expect(response.status(), path).toBe(404);
  }
  expect((await request.get("/api/auth/admin/list-users", { headers: { origin } })).status()).toBe(404);
});
