import { execSync } from "node:child_process";

import { expect, test, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";

import { slugify } from "../../src/lib/slug";

import { randomIp, registerAndVerify, uniqueUser } from "./helpers";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

async function testPng(width = 800, height = 450) {
  return sharp({ create: { width, height, channels: 3, background: "#2b6cb0" } }).png().toBuffer();
}

async function becomeCreator(page: Page, displayName: string) {
  await page.goto("/de/dashboard/projects");
  await expect(page.getByRole("heading", { name: "Creator werden" })).toBeVisible();
  await page.getByLabel("Öffentlicher Name").fill(displayName);
  await page.getByRole("button", { name: "Creator-Profil anlegen" }).click();
  await expect(page.getByRole("heading", { name: "Noch keine Projekte" })).toBeVisible();
}

/** Legt ein Projekt mit Titelbild und Version an; liefert ID und Slug. */
async function createSubmittableProject(page: Page, title: string) {
  await page.goto("/de/dashboard/projects/new");
  await page.getByLabel(/^Kategorie/).selectOption({ label: "Busse & Fahrzeuge" });
  await page.getByLabel(/^Lizenz/).fill("Private Nutzung erlaubt");
  await page.getByRole("tabpanel").getByLabel("Titel", { exact: true }).fill(title);
  await page.getByRole("tabpanel").getByLabel("Kurzbeschreibung").fill("Ein Testbus aus dem E2E-Test.");
  await page.getByRole("tabpanel").getByLabel("Beschreibung", { exact: true }).fill("Ausführliche Beschreibung.\n\nZweiter Absatz.");
  await page.getByRole("button", { name: "Projekt anlegen" }).click();
  await expect(page).toHaveURL(/\/de\/dashboard\/projects\/[a-z0-9]+\/edit$/);
  const id = /projects\/([a-z0-9]+)\/edit/.exec(page.url())?.[1] ?? "";

  await expect(page.getByRole("button", { name: "Zur Prüfung einreichen" })).toBeDisabled();

  await page.locator("#cover-upload-file").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: await testPng() });
  await page.locator("#cover-upload-alt").fill("Blauer Testbus");
  await page.getByRole("button", { name: "Titelbild hochladen" }).click();
  await expect(page.getByText("Bild gespeichert.")).toBeVisible();

  const newVersion = page.locator("details", { hasText: "Neue Version" });
  await newVersion.getByLabel("Versionsnummer").fill("1.0.0");
  await newVersion.getByLabel("URL").fill("https://example.com/e2e-download");
  await newVersion.getByRole("button", { name: "Version anlegen" }).click();
  await expect(page.locator("summary", { hasText: "1.0.0" })).toBeVisible();

  return { id, slug: slugify(title) };
}

async function adminPage(browser: Browser) {
  const context = await browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const page = await context.newPage();
  const admin = uniqueUser("e2e-admin");
  await registerAndVerify(page, admin);
  execSync(`pnpm user:set-role ${admin.email} admin`, { stdio: "pipe" });
  return page;
}

test("Creator-Ablauf: Profil, Projekt, Bilder, Version, Einreichung, Freigabe", async ({ page, browser }) => {
  const user = uniqueUser("e2e-creator");
  await registerAndVerify(page, user);
  await becomeCreator(page, "E2E Werkstatt");

  const title = `E2E Testbus ${Date.now().toString(36)}`;
  const project = await createSubmittableProject(page, title);

  // Gefälschte Bilddatei wird abgelehnt
  await page.locator("#screenshot-upload-file").setInputFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"),
  });
  await page.locator("#screenshot-upload-alt").fill("Fake");
  await page.getByRole("button", { name: "Screenshot hochladen" }).click();
  await expect(page.getByText("Nur JPEG-, PNG- oder WebP-Bilder sind erlaubt.")).toBeVisible();

  // Hochgeladenes Bild ist WebP und wird mit sicheren Headern ausgeliefert
  const coverSrc = await page.locator('img[src^="/media/"]').first().getAttribute("src");
  expect(coverSrc).toMatch(/^\/media\/[a-f0-9]{32}\.webp$/);
  const media = await page.request.get(coverSrc ?? "");
  expect(media.status()).toBe(200);
  expect(media.headers()["content-type"]).toBe("image/webp");
  expect(media.headers()["x-content-type-options"]).toBe("nosniff");

  // Einreichen
  await page.getByRole("button", { name: "Zur Prüfung einreichen" }).click();
  await expect(page.getByText("In Prüfung", { exact: true })).toBeVisible();

  // Vor der Freigabe nicht öffentlich
  await page.goto(`/de/mods/${project.slug}`);
  await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();

  // Admin gibt frei
  const admin = await adminPage(browser);
  await admin.goto("/de/admin/projects");
  const item = admin.locator("li", { hasText: title });
  await item.getByRole("button", { name: "Freigeben" }).click();
  // Nach der Entscheidung verschwindet das Projekt aus der Liste „In Prüfung“.
  await expect(item).toHaveCount(0);

  // Jetzt öffentlich, mit Titelbild und Downloadlink
  await page.goto(`/de/mods/${project.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.locator('img[src^="/media/"]').first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Externe Downloadseite öffnen/ })).toHaveAttribute("href", /^\/go\//);

  await page.goto("/de/dashboard/projects");
  await expect(page.locator("li", { hasText: title }).getByText("Veröffentlicht")).toBeVisible();
});

test("Zurückweisen mit Begründung und erneutes Einreichen", async ({ page, browser }) => {
  await registerAndVerify(page, uniqueUser("e2e-creator"));
  await becomeCreator(page, "E2E Ablehnung");
  const title = `E2E Abgelehnt ${Date.now().toString(36)}`;
  const project = await createSubmittableProject(page, title);
  await page.getByRole("button", { name: "Zur Prüfung einreichen" }).click();
  await expect(page.getByText("In Prüfung", { exact: true })).toBeVisible();

  const admin = await adminPage(browser);
  await admin.goto("/de/admin/projects");
  const item = admin.locator("li", { hasText: title });
  await item.getByText("Zurückweisen", { exact: true }).first().click();
  await item.getByRole("button", { name: "Zurückweisen" }).click();
  await expect(item.getByText("Dieses Feld ist erforderlich.")).toBeVisible();
  await item.getByLabel("Begründung für den Creator").fill("Bitte Screenshots ergänzen.");
  await item.getByRole("button", { name: "Zurückweisen" }).click();
  // Nach der Entscheidung verschwindet das Projekt aus der Liste „In Prüfung“.
  await expect(item).toHaveCount(0);

  await page.goto(`/de/dashboard/projects/${project.id}/edit`);
  await expect(page.getByText("Zurückgewiesen", { exact: true })).toBeVisible();
  await expect(page.getByText("Bitte Screenshots ergänzen.")).toBeVisible();
  await page.getByRole("button", { name: "Zur Prüfung einreichen" }).click();
  await expect(page.getByText("In Prüfung", { exact: true })).toBeVisible();
});

test("Fremde Projekte sind nicht erreichbar – auch nicht per manipulierter ID", async ({ page, browser }) => {
  await registerAndVerify(page, uniqueUser("e2e-creator"));
  await becomeCreator(page, "E2E Besitzer");
  const foreign = await createSubmittableProject(page, `E2E Fremd ${Date.now().toString(36)}`);

  const context = await browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const other = await context.newPage();
  await registerAndVerify(other, uniqueUser("e2e-creator"));
  await becomeCreator(other, "E2E Angreifer");

  await other.goto(`/de/dashboard/projects/${foreign.id}/edit`);
  await expect(other.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
  await other.goto(`/de/dashboard/projects/${foreign.id}/preview`);
  await expect(other.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();

  // Eigenes Projekt öffnen und die versteckte Projekt-ID im Formular austauschen
  const own = await createSubmittableProject(other, `E2E Eigen ${Date.now().toString(36)}`);
  await other.goto(`/de/dashboard/projects/${own.id}/edit`);
  await other.locator('input[name="projectId"]').first().evaluate((el, id) => ((el as HTMLInputElement).value = id), foreign.id);
  await other.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(other.getByRole("alert").filter({ hasText: "Das Projekt wurde nicht gefunden." })).toBeVisible();

  // Das fremde Projekt ist unverändert
  await page.goto(`/de/dashboard/projects/${foreign.id}/edit`);
  await expect(page.getByRole("tabpanel").getByLabel("Titel", { exact: true })).toHaveValue(/^E2E Fremd /);
});

test("Ohne Creator-Status gibt es keinen Editor", async ({ page }) => {
  await registerAndVerify(page, uniqueUser());
  await page.goto("/de/dashboard/projects/new");
  await expect(page).toHaveURL(/\/de\/dashboard\/projects$/);
  await expect(page.getByRole("heading", { name: "Creator werden" })).toBeVisible();
});

test("Editor validiert Pflichtfelder und behält Eingaben", async ({ page }) => {
  await registerAndVerify(page, uniqueUser("e2e-creator"));
  await becomeCreator(page, "E2E Validierung");
  await page.goto("/de/dashboard/projects/new");
  await page.getByRole("tabpanel").getByLabel("Titel", { exact: true }).fill("Nur ein Titel");
  await page.getByLabel("Originalquelle (optional)").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Projekt anlegen" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Bitte prüfe die markierten Felder." })).toBeVisible();
  await expect(page.getByText("Bitte wähle eine Kategorie.")).toBeVisible();
  await expect(page.getByText("Bitte gib eine öffentliche http(s)-Adresse ein.")).toBeVisible();
  await expect(page.getByRole("tabpanel").getByLabel("Kurzbeschreibung")).toHaveAttribute("aria-invalid", "true");
  // Eingaben bleiben erhalten
  await expect(page.getByRole("tabpanel").getByLabel("Titel", { exact: true })).toHaveValue("Nur ein Titel");
});
