import { expect, test, type Page } from "@playwright/test";

import { adminPage, becomeCreator, createSubmittableProject, openEditorTab, randomIp, registerAndVerify, uniqueUser } from "./helpers";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

async function submitAndApprove(page: Page, admin: Page, title: string) {
  await page.getByRole("button", { name: "Zur Prüfung einreichen" }).click();
  await expect(page.getByText("In Prüfung", { exact: true })).toBeVisible();
  await admin.goto("/de/admin/projects");
  const item = admin.locator("li", { hasText: title });
  await item.getByRole("button", { name: "Freigeben" }).click();
  await expect(item).toHaveCount(0);
}

test("Benötigte Projekte im Hub: Auswahl im Editor, Verweise in beide Richtungen", async ({ page, browser }) => {
  const run = Date.now().toString(36);
  await registerAndVerify(page, uniqueUser("e2e-creator"));
  await becomeCreator(page, "E2E Abhängigkeiten");
  const admin = await adminPage(browser);

  const busTitle = `E2E Bus ${run}`;
  const bus = await createSubmittableProject(page, busTitle);
  await submitAndApprove(page, admin, busTitle);

  const mapTitle = `E2E Karte ${run}`;
  const map = await createSubmittableProject(page, mapTitle);
  await openEditorTab(page, "Add-ons");
  const section = page.getByRole("region", { name: "Benötigte Projekte im Hub" });
  const search = section.getByLabel("Projekt im Hub suchen");

  // Nicht veröffentlichte Projekte (hier das eigene) werden nicht gefunden.
  await search.fill(mapTitle);
  await expect(section.getByText("Keine veröffentlichten Projekte gefunden.")).toBeVisible();

  await search.fill(busTitle);
  // Enter in der Suche schickt das Projektformular nicht ab.
  await search.press("Enter");
  await page.waitForTimeout(1000);
  await expect(page.getByText("Änderungen gespeichert.")).toHaveCount(0);
  await section.getByRole("button", { name: `Hinzufügen: ${busTitle}` }).click();
  await expect(section.getByRole("list", { name: "Ausgewählte Projekte" }).getByText(busTitle, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByText("Änderungen gespeichert.").first()).toBeVisible();

  // Gespeichert: nach dem Neuladen weiter ausgewählt.
  await page.reload();
  await openEditorTab(page, "Add-ons");
  await expect(section.getByRole("list", { name: "Ausgewählte Projekte" }).getByText(busTitle, { exact: true })).toBeVisible();

  await submitAndApprove(page, admin, mapTitle);

  // Karte verweist auf den Bus …
  await page.goto(`/de/mods/${map.slug}`);
  const requires = page.getByRole("list", { name: "Projekte im Hub" });
  await expect(requires.getByRole("link", { name: new RegExp(busTitle) })).toBeVisible();

  // … und der Bus zeigt „Wird benötigt von“. Listen werden im Hintergrund
  // erneuert (stale-while-revalidate), daher ggf. ein paarmal neu laden.
  await expect(async () => {
    await page.goto(`/de/mods/${bus.slug}`);
    await expect(page.getByRole("list", { name: "Wird benötigt von" }).getByRole("link", { name: new RegExp(mapTitle) })).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 20_000 });

  await page.getByRole("list", { name: "Wird benötigt von" }).getByRole("link", { name: new RegExp(mapTitle) }).click();
  await expect(page.getByRole("heading", { level: 1, name: mapTitle })).toBeVisible();
});
