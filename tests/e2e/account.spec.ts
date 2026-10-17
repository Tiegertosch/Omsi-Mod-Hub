import { execSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import {
  becomeCreator,
  createAdmin,
  createSubmittableProject,
  E2E_MAIL_DOMAIN,
  login,
  randomIp,
  registerAndVerify,
  uniqueUser,
  waitForMail,
  waitForMailLink,
} from "./helpers";

// Jeder Test erhält eine eigene IP, damit IP-basierte Rate-Limits nicht greifen.
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0";

test("E-Mail-Adresse ändern: Bestätigung über alte und neue Adresse", async ({ page }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);
  const newEmail = `${user.username}-neu@${E2E_MAIL_DOMAIN}`;

  await page.goto("/de/dashboard/settings");
  const section = page.getByRole("region", { name: "E-Mail-Adresse" });
  await expect(section.getByLabel("Aktuelle Adresse")).toHaveValue(user.email);

  // Falsches Passwort und unveränderte Adresse werden abgewiesen.
  await section.getByLabel("Neue E-Mail-Adresse").fill(newEmail);
  await section.getByLabel("Aktuelles Passwort").fill("falsch-falsch-falsch");
  await section.getByRole("button", { name: "E-Mail-Adresse ändern" }).click();
  await expect(section.getByRole("alert")).toContainText("Das aktuelle Passwort ist falsch");

  await section.getByLabel("Neue E-Mail-Adresse").fill(user.email.toUpperCase());
  await section.getByLabel("Aktuelles Passwort").fill(user.password);
  await section.getByRole("button", { name: "E-Mail-Adresse ändern" }).click();
  await expect(section.getByText("Das ist bereits deine aktuelle Adresse.")).toBeVisible();

  const since = Date.now() - 1000;
  await section.getByLabel("Neue E-Mail-Adresse").fill(newEmail);
  await section.getByLabel("Aktuelles Passwort").fill(user.password);
  await section.getByRole("button", { name: "E-Mail-Adresse ändern" }).click();
  await expect(section.getByRole("status")).toContainText(user.email);

  // Schritt 1: Link an die bisherige Adresse. Die Adresse ändert sich noch nicht.
  const confirmLink = await waitForMailLink(user.email, /ändern/i, since);
  await page.goto(confirmLink);
  await expect(page).toHaveURL(/\/de\/dashboard\/settings\?emailChange=1$/);
  await expect(section.getByRole("status")).toContainText("Link bestätigt");
  await expect(section.getByLabel("Aktuelle Adresse")).toHaveValue(user.email);

  // Schritt 2: Link an die neue Adresse übernimmt sie.
  const verifyLink = await waitForMailLink(newEmail, /neue E-Mail-Adresse bestätigen/i, since);
  await page.goto(verifyLink);
  await expect(section.getByLabel("Aktuelle Adresse")).toHaveValue(newEmail);

  // Anmeldung nur noch mit der neuen Adresse.
  await page.context().clearCookies();
  await login(page, user.email, user.password);
  await expect(page.getByRole("alert").filter({ hasText: "Passwort ist falsch" })).toBeVisible();
  await login(page, newEmail, user.password);
  await expect(page).toHaveURL(/\/de\/dashboard$/);
});

test("Angemeldete Geräte anzeigen und ein anderes Gerät abmelden", async ({ page, browser }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);

  const other = await browser.newContext({
    locale: "de-DE",
    userAgent: FIREFOX_LINUX,
    extraHTTPHeaders: { "x-forwarded-for": randomIp() },
  });
  const otherPage = await other.newPage();
  await login(otherPage, user.username, user.password);
  await expect(otherPage).toHaveURL(/\/de\/dashboard$/);

  await page.goto("/de/dashboard/settings");
  const section = page.getByRole("region", { name: "Angemeldete Geräte" });
  const rows = section.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Dieses Gerät");
  // Die aktuelle Sitzung lässt sich hier nicht beenden, nur über „Abmelden“ im Menü.
  await expect(rows.first().getByRole("button")).toHaveCount(0);
  await expect(section.getByText("Firefox unter Linux")).toBeVisible();

  await section.getByRole("button", { name: "Firefox unter Linux abmelden" }).click();
  await expect(rows).toHaveCount(1);
  await expect(section.getByRole("button", { name: "Alle anderen Geräte abmelden" })).toHaveCount(0);

  // Das andere Gerät ist sofort abgemeldet.
  await otherPage.goto("/de/dashboard/settings");
  await expect(otherPage).toHaveURL(/\/de\/login\?next=/);
  await other.close();

  // Die eigene Sitzung bleibt bestehen.
  await page.reload();
  await expect(rows).toHaveCount(1);
});

test("Alle anderen Geräte abmelden", async ({ page, browser }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);

  const others = await Promise.all(
    [0, 1].map(() => browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } })),
  );
  for (const context of others) {
    const otherPage = await context.newPage();
    await login(otherPage, user.email, user.password);
    await expect(otherPage).toHaveURL(/\/de\/dashboard$/);
  }

  await page.goto("/de/dashboard/settings");
  const section = page.getByRole("region", { name: "Angemeldete Geräte" });
  await expect(section.getByRole("listitem")).toHaveCount(3);
  await section.getByRole("button", { name: "Alle anderen Geräte abmelden" }).click();
  await expect(section.getByRole("listitem")).toHaveCount(1);

  for (const context of others) {
    const otherPage = context.pages()[0];
    await otherPage.goto("/de/dashboard");
    await expect(otherPage).toHaveURL(/\/de\/login\?next=/);
    await context.close();
  }
});

test("Konto löschen entfernt Konto, Creator-Profil und Projekte", async ({ page, browser }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);
  await becomeCreator(page, `E2E Löschtest ${user.username}`);
  const title = `E2E Löschprojekt ${user.username}`;
  const project = await createSubmittableProject(page, title);
  await page.getByRole("button", { name: "Zur Prüfung einreichen" }).click();
  await expect(page.getByText("In Prüfung", { exact: true })).toBeVisible();

  const admin = await createAdmin(browser);
  await admin.page.goto("/de/admin/projects");
  const item = admin.page.locator("li", { hasText: title });
  await item.getByRole("button", { name: "Freigeben" }).click();
  await expect(item).toHaveCount(0);
  await admin.page.context().close();

  // Vor dem Löschen öffentlich erreichbar
  expect((await page.request.get(`/de/creators/${user.username}`)).status()).toBe(200);
  expect((await page.request.get(`/de/mods/${project.slug}`)).status()).toBe(200);

  await page.goto("/de/dashboard/settings");
  const section = page.getByRole("region", { name: "Konto löschen" });
  await expect(section).toContainText("1 Projekt wird mitgelöscht, davon 1 veröffentlicht.");
  await section.getByText("Konto löschen …").click();

  // Falscher Benutzername und falsches Passwort verhindern das Löschen.
  await section.getByLabel("Aktuelles Passwort").fill(user.password);
  await section.getByLabel(/Benutzernamen ein/).fill("jemand-anderes");
  await section.getByRole("button", { name: "Konto endgültig löschen" }).click();
  await expect(section.getByText("Der Benutzername stimmt nicht überein.")).toBeVisible();

  await section.getByLabel("Aktuelles Passwort").fill("falsch-falsch-falsch");
  await section.getByLabel(/Benutzernamen ein/).fill(user.username);
  await section.getByRole("button", { name: "Konto endgültig löschen" }).click();
  await expect(section.getByRole("alert")).toContainText("Das aktuelle Passwort ist falsch");

  const since = Date.now() - 1000;
  await section.getByLabel("Aktuelles Passwort").fill(user.password);
  await section.getByLabel(/Benutzernamen ein/).fill(user.username.toUpperCase());
  await section.getByRole("button", { name: "Konto endgültig löschen" }).click();
  await expect(page).toHaveURL(/\/de\/account-deleted$/);
  await expect(page.getByRole("heading", { name: "Konto gelöscht" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Anmelden" })).toBeVisible();

  // Bestätigungsmail, danach keine Anmeldung mehr; Profil und Projekt sind sofort weg.
  await waitForMail(user.email, /Konto wurde gelöscht/, since);
  expect((await page.request.get(`/de/creators/${user.username}`)).status()).toBe(404);
  expect((await page.request.get(`/de/mods/${project.slug}`)).status()).toBe(404);
  await login(page, user.email, user.password);
  await expect(page.getByRole("alert").filter({ hasText: "Passwort ist falsch" })).toBeVisible();
});

test("Admin-Konten können sich nicht selbst löschen", async ({ page }) => {
  const user = uniqueUser("e2e-admin");
  await registerAndVerify(page, user);
  execSync(`pnpm user:set-role ${user.email} admin`, { stdio: "pipe" });

  await page.goto("/de/dashboard/settings");
  const section = page.getByRole("region", { name: "Konto löschen" });
  await expect(section).toContainText("Admin-Konten können nicht selbst gelöscht werden");
  await expect(section.getByRole("button", { name: "Konto endgültig löschen" })).toHaveCount(0);
});

test("Geschützte Better-Auth-Endpunkte sind über HTTP gesperrt", async ({ page }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);
  // Mit gültiger Origin, damit nicht schon die Origin-Prüfung von Better Auth greift.
  const origin = new URL(page.url()).origin;
  for (const path of [
    "/api/auth/change-email",
    "/api/auth/update-user",
    "/api/auth/delete-user",
    "/api/auth/send-verification-email",
    "/api/auth/email-otp/send-verification-otp",
    "/api/auth/email-otp/verify-email",
    "/api/auth/sign-in/email-otp",
    "/api/auth/forget-password/email-otp",
  ]) {
    const response = await page.request.post(path, {
      headers: { origin },
      data: { newEmail: `x@${E2E_MAIL_DOMAIN}`, name: "x", email: user.email, otp: "000000", type: "sign-in" },
    });
    expect(response.status(), path).toBe(404);
  }
  expect((await page.request.get("/api/auth/list-sessions", { headers: { origin } })).status()).toBe(404);
  // Gegenprobe: Ein nicht gesperrter Endpunkt antwortet normal.
  expect((await page.request.get("/api/auth/get-session", { headers: { origin } })).status()).toBe(200);
});
