import { expect, test } from "@playwright/test";

import { adminPage, becomeCreator, createSubmittableProject, randomIp, registerAndVerify, uniqueUser } from "./helpers";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

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
  // Erst beim Absenden austauschen: Vor der Hydration gesetzte Werte überschreibt React wieder.
  await other.evaluate((id) => {
    window.addEventListener(
      "submit",
      (event) => {
        const input = (event.target as HTMLFormElement).querySelector<HTMLInputElement>('input[name="projectId"]');
        if (input) input.value = id;
      },
      { capture: true },
    );
  }, foreign.id);
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
