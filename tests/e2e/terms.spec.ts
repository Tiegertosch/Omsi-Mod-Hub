import { expect, test } from "@playwright/test";

import { login, randomIp, registerAndVerify, setTermsVersion, uniqueUser } from "./helpers";

// Jeder Test erhält eine eigene IP, damit IP-basierte Rate-Limits nicht greifen.
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

test("Neue Konten stimmen bei der Registrierung zu und sehen kein Popup", async ({ page }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);
  await page.goto("/de/mods");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Neue Fassung: Popup mit Änderungen, Rechtsseiten bleiben lesbar, Akzeptieren schließt es", async ({ page }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);
  setTermsVersion(user.email, "2000-01-01");

  await page.goto("/de/dashboard");
  const dialog = page.getByRole("dialog", { name: "Neue Nutzungsbedingungen" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Die Änderungen im Überblick")).toBeVisible();
  await expect(dialog.getByRole("listitem").first()).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Vollständige Fassung lesen/ })).toHaveAttribute(
    "href",
    /\/de\/legal\/terms\?fassung=\d{4}-\d{2}-\d{2}$/,
  );

  // Escape schließt das Popup nicht.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  // Auf den Rechtsseiten bleibt es geschlossen, damit man die Fassung lesen kann.
  await page.goto("/de/legal/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nutzungsbedingungen");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/de/dashboard");
  await dialog.getByRole("button", { name: "Änderungen akzeptieren" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Konto ohne gespeicherte Zustimmung: Ablehnen schließt das Konto nach Passwortbestätigung", async ({ page }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);
  setTermsVersion(user.email, null);

  await page.goto("/de/dashboard");
  const dialog = page.getByRole("dialog", { name: "Bitte bestätige die Nutzungsbedingungen" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Nicht akzeptieren und Konto schließen" }).click();

  const closing = page.getByRole("dialog", { name: "Konto schließen" });
  await expect(closing).toBeVisible();
  await expect(closing.getByText(`dein Konto „${user.username}“`)).toBeVisible();
  await expect(closing.getByText("keine Projekte (du hast derzeit keine)")).toBeVisible();

  // Zurück zur Übersicht ist möglich.
  await closing.getByRole("button", { name: "Zurück" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Nicht akzeptieren und Konto schließen" }).click();

  await closing.getByLabel("Passwort zur Bestätigung").fill("falsch-falsch-falsch");
  await closing.getByRole("button", { name: "Konto endgültig schließen" }).click();
  await expect(closing.getByRole("alert").filter({ hasText: "Das aktuelle Passwort ist falsch" })).toBeVisible();

  await closing.getByLabel("Passwort zur Bestätigung").fill(user.password);
  await closing.getByRole("button", { name: "Konto endgültig schließen" }).click();
  await expect(page).toHaveURL(/\/de\/account-deleted$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await login(page, user.email, user.password);
  await expect(page.getByRole("alert").filter({ hasText: "Passwort ist falsch" })).toBeVisible();
});

test("Serverseitige Sperre: ohne Zustimmung keine Änderungen, auch wenn das Popup umgangen wird", async ({ page }) => {
  const user = uniqueUser();
  await registerAndVerify(page, user);
  setTermsVersion(user.email, "2000-01-01");

  await page.goto("/de/dashboard/settings");
  const dialog = page.getByRole("dialog", { name: "Neue Nutzungsbedingungen" });
  await expect(dialog).toBeVisible();
  // Umgehung simulieren: Popup aus der Seite entfernen.
  await page.evaluate(() => document.querySelector("dialog")?.remove());

  const profile = page.getByRole("region", { name: "Profil" });
  await profile.getByLabel("Anzeigename").fill("Umgangen");
  await profile.getByRole("button", { name: "Profil speichern" }).click();
  await expect(profile.getByRole("alert")).toContainText("Bitte stimme zuerst den aktuellen Nutzungsbedingungen zu.");

  // Creator werden ist ebenfalls gesperrt.
  await page.goto("/de/dashboard/projects");
  await page.evaluate(() => document.querySelector("dialog")?.remove());
  await page.getByLabel("Öffentlicher Name").fill("Umgangene Werkstatt");
  await page.getByRole("button", { name: "Creator-Profil anlegen" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Bitte stimme zuerst" })).toBeVisible();

  // Nach dem Akzeptieren klappt es.
  await page.goto("/de/dashboard/settings");
  await dialog.getByRole("button", { name: "Änderungen akzeptieren" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await profile.getByLabel("Anzeigename").fill("Akzeptiert");
  await profile.getByRole("button", { name: "Profil speichern" }).click();
  await expect(profile.getByRole("status")).toContainText("Profil gespeichert.");
});
