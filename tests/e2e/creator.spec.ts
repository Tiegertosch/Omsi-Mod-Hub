import { expect, test } from "@playwright/test";

import {
  adminPage,
  becomeCreator,
  createSubmittableProject,
  germanTexts,
  openEditorTab,
  randomIp,
  registerAndVerify,
  uniqueUser,
} from "./helpers";

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
  await openEditorTab(page, "Bilder");
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

  // Änderungen an veröffentlichten Projekten sind trotz Zwischenspeicherung sofort öffentlich.
  await page.goto(`/de/dashboard/projects/${project.id}/edit`);
  await openEditorTab(page, "Beschreibung");
  await germanTexts(page).getByLabel("Kurzbeschreibung").fill("Neue Kurzbeschreibung nach der Freigabe.");

  // Formatierung über Werkzeugleiste und Tastenkürzel
  const descriptionField = germanTexts(page).getByRole("group", { name: "Beschreibung", exact: true });
  const description = descriptionField.getByRole("textbox");
  const select = (from: string, to?: string) =>
    description.evaluate(
      (el: HTMLTextAreaElement, [a, b]) => {
        el.focus();
        const start = el.value.indexOf(a);
        el.setSelectionRange(start, b ? el.value.indexOf(b) + b.length : start + a.length);
      },
      [from, to ?? ""] as const,
    );
  await description.fill("Features\nSound\nLicht\n\nDas ist wichtig <b>roh</b>");
  await select("Features");
  await descriptionField.getByRole("button", { name: "Überschrift", exact: true }).click();
  await select("Sound", "Licht");
  await descriptionField.getByRole("button", { name: "Aufzählung" }).click();
  await select("wichtig");
  await descriptionField.getByRole("button", { name: "Fett" }).click();
  await select("Das");
  await page.keyboard.press("Control+i");
  await expect(description).toHaveValue("## Features\n- Sound\n- Licht\n\n*Das* ist **wichtig** <b>roh</b>");
  // Erneut anwenden nimmt die Formatierung zurück
  await select("Das");
  await descriptionField.getByRole("button", { name: "Kursiv" }).click();
  await expect(description).toHaveValue("## Features\n- Sound\n- Licht\n\nDas ist **wichtig** <b>roh</b>");

  await descriptionField.getByRole("button", { name: "Vorschau" }).click();
  await expect(descriptionField.getByRole("heading", { name: "Features" })).toBeVisible();
  await expect(descriptionField.getByRole("listitem")).toHaveText(["Sound", "Licht"]);
  await expect(descriptionField.getByRole("button", { name: "Fett" })).toBeDisabled();
  await descriptionField.getByRole("button", { name: "Schreiben" }).click();
  await expect(description).toBeFocused();

  // Voraussetzungen: Freeware mit Link, Payware mit Link, eine ohne Link
  await openEditorTab(page, "Add-ons & Mitwirkende");
  const editorRequirements = page.getByRole("region", { name: "Voraussetzungen & benötigte Add-ons" });
  for (let row = 0; row < 3; row++) {
    await editorRequirements.getByRole("button", { name: "Voraussetzung hinzufügen" }).click();
  }
  const rows = editorRequirements.getByRole("listitem");
  await rows.nth(0).getByLabel("Name").fill("Haltestellen-Baukasten");
  await rows.nth(0).getByLabel(/^Link/).fill("https://example.com/baukasten");
  await rows.nth(1).getByLabel("Name").fill("Sound-Paket");
  await rows.nth(1).getByLabel(/^Link/).fill("https://shop.example.com/sound");
  await rows.nth(1).getByLabel("Art").selectOption("PAYWARE");
  await rows.nth(2).getByLabel("Name").fill("Alter Patch");

  // Projekt als Payware kennzeichnen
  await openEditorTab(page, "Allgemein");
  await page.getByRole("radio", { name: "Kostenpflichtig (Payware)" }).check();

  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByText("Änderungen gespeichert.").first()).toBeVisible();
  await page.goto(`/de/mods/${project.slug}`);
  await expect(page.getByText("Neue Kurzbeschreibung nach der Freigabe.").first()).toBeVisible();

  // Payware: Badge im Kopf, Downloadbutton „Zum Shop“, Hinweis zum Kauf beim Anbieter
  await expect(page.locator("main header").getByText("Payware", { exact: true })).toBeVisible();
  const downloadBox = page.getByRole("region", { name: "Download", exact: true });
  await expect(downloadBox.getByRole("link", { name: /^Zum Shop/ })).toHaveAttribute("href", /^\/go\//);
  await expect(downloadBox.getByText(/^Kostenpflichtig – Kauf und Bezahlung erfolgen beim Anbieter/)).toBeVisible();

  // Formatierte Beschreibung; eingegebenes HTML bleibt sichtbarer Text
  const publicDescription = page.getByRole("region", { name: "Beschreibung" });
  await expect(publicDescription.getByRole("heading", { level: 3, name: "Features" })).toBeVisible();
  await expect(publicDescription.getByRole("listitem")).toHaveText(["Sound", "Licht"]);
  await expect(publicDescription.locator("strong")).toHaveText("wichtig");
  await expect(publicDescription.getByText("<b>roh</b>")).toBeVisible();
  await expect(publicDescription.locator("b")).toHaveCount(0);

  const requirements = page.getByRole("region", { name: "Voraussetzungen & benötigte Add-ons" });
  const download = requirements.getByRole("link", { name: /^Download.*Haltestellen-Baukasten/ });
  await expect(download).toHaveAttribute("href", "https://example.com/baukasten");
  await expect(download).toHaveAttribute("target", "_blank");
  await expect(download).toHaveAttribute("rel", /noopener.*nofollow/);
  await expect(requirements.getByRole("link", { name: /^Zum Shop.*Sound-Paket/ })).toHaveAttribute(
    "href",
    "https://shop.example.com/sound",
  );
  await expect(requirements.getByText("Alter Patch")).toBeVisible();
  await expect(requirements.getByRole("link")).toHaveCount(2);
  await expect(requirements.getByText("Payware")).toHaveCount(1);
  await expect(requirements.getByText("Freeware")).toHaveCount(2);
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
  await page.goto(`/de/dashboard/projects/${foreign.id}/edit#texts`);
  await expect(germanTexts(page).getByLabel("Titel", { exact: true })).toHaveValue(/^E2E Fremd /);
});

test("Ohne Creator-Status gibt es keinen Editor", async ({ page }) => {
  await registerAndVerify(page, uniqueUser());
  await page.goto("/de/dashboard/projects/new");
  await expect(page).toHaveURL(/\/de\/dashboard\/projects$/);
  await expect(page.getByRole("heading", { name: "Creator werden" })).toBeVisible();
});

test("Editor validiert Pflichtfelder, zeigt Fehler in Tabs und behält Eingaben", async ({ page }) => {
  await registerAndVerify(page, uniqueUser("e2e-creator"));
  await becomeCreator(page, "E2E Validierung");
  await page.goto("/de/dashboard/projects/new");
  // Ohne Bilder und Versionen: die gibt es erst nach dem Anlegen.
  const tabs = page.getByRole("tablist", { name: "Bereiche des Projekts" }).getByRole("tab");
  await expect(tabs).toHaveText(["Allgemein", "Beschreibung", "Add-ons & Mitwirkende"]);

  await page.getByLabel("Originalquelle (optional)").fill("javascript:alert(1)");
  // Tastatur: Pfeiltaste nach rechts öffnet den nächsten Tab
  await page.getByRole("tab", { name: "Allgemein" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Beschreibung" })).toBeFocused();
  await expect(page).toHaveURL(/#texts$/);
  await germanTexts(page).getByLabel("Titel", { exact: true }).fill("Nur ein Titel");
  // Auf der englischen Fassung und in einem fehlerfreien Tab absenden
  await page.getByRole("tab", { name: "Englisch" }).click();
  await openEditorTab(page, "Add-ons & Mitwirkende");
  await page.getByRole("button", { name: "Projekt anlegen" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Bitte prüfe die markierten Felder." })).toBeVisible();
  // Der erste Tab mit Fehlern öffnet sich, betroffene Tabs sind markiert
  await expect(page.getByRole("tab", { name: "Allgemein (enthält Fehler)" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Beschreibung (enthält Fehler)" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Add-ons & Mitwirkende", exact: true })).toBeVisible();
  await expect(page.getByText("Bitte wähle eine Kategorie.")).toBeVisible();
  await expect(page.getByText("Bitte gib eine öffentliche http(s)-Adresse ein.")).toBeVisible();

  // Im Tab „Beschreibung“ ist wieder Deutsch gewählt, weil dort die Fehler liegen
  await openEditorTab(page, "Beschreibung");
  await expect(germanTexts(page).getByLabel("Kurzbeschreibung")).toHaveAttribute("aria-invalid", "true");
  // Eingaben bleiben erhalten
  await expect(germanTexts(page).getByLabel("Titel", { exact: true })).toHaveValue("Nur ein Titel");
});
