import { expect, test } from "@playwright/test";

// Diese Tests setzen die Beispieldaten aus `pnpm db:seed` voraus.

test("Startseite zeigt Kategorien und Projekte aus der Datenbank", async ({ page }) => {
  await page.goto("/de");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Finde die passende Mod");
  await expect(page.getByRole("link", { name: /Busse & Fahrzeuge/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Neu veröffentlicht" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Unveröffentlichter Entwurf" })).toHaveCount(0);
});

test("Kategorie-Kachel führt in den gefilterten Katalog", async ({ page }) => {
  await page.goto("/de");
  await page.getByRole("link", { name: /Busse & Fahrzeuge/ }).click();
  await expect(page).toHaveURL(/\/de\/mods\/busse$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Busse & Fahrzeuge");
  // Inhalt statt exakter Anzahl prüfen: parallele Creator-Tests veröffentlichen ebenfalls Busse.
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "Solobus SL12 (fiktives Modell)" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Neustadt am Kanal" })).toHaveCount(0);
});

test("Sprachumschaltung behält Pfad und Suchparameter", async ({ page }) => {
  await page.goto("/de/mods/busse?sort=updated");
  const english = page.getByRole("banner").getByRole("link", { name: "English" });
  // Bis zur Hydration zeigt der statische Rahmen auf die Startseite; danach auf denselben Pfad.
  await expect(english).toHaveAttribute("href", "/en/mods/busse?sort=updated");
  await english.click();
  await expect(page).toHaveURL(/\/en\/mods\/busse\?sort=updated$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Buses & vehicles");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("Suche im Header führt über die Ergebnisliste zur Detailseite", async ({ page }) => {
  await page.goto("/de");
  const search = page.getByRole("banner").getByRole("searchbox", { name: "Mods durchsuchen" });
  await search.fill("gelenkbus");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/de\/search\?q=gelenkbus/);
  await page.getByRole("link", { name: "Gelenkbus GL18 (fiktives Modell)" }).click();
  await expect(page).toHaveURL(/\/de\/mods\/gelenkbus-gl18$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gelenkbus GL18 (fiktives Modell)");
});

test("Katalog: Tag-Filter und Sortierung stehen in der URL", async ({ page }) => {
  await page.goto("/de/mods");
  await page.getByRole("link", { name: "Diesel", exact: true }).click();
  await expect(page).toHaveURL(/tag=diesel/);
  await expect(page.locator("p[aria-live=polite]")).toHaveText("2 Projekte");
  await page.getByRole("link", { name: "Zuletzt aktualisiert" }).click();
  await expect(page).toHaveURL(/tag=diesel/);
  await expect(page).toHaveURL(/sort=updated/);
});

test("Katalog: Preisfilter trennt Freeware und Payware, Payware ist gekennzeichnet", async ({ page }) => {
  await page.goto("/de/mods/busse");
  const main = page.getByRole("main");
  const paid = main.getByRole("link", { name: "Gelenkbus GL18 (fiktives Modell)" });
  const free = main.getByRole("link", { name: "Solobus SL12 (fiktives Modell)" });
  await expect(paid).toBeVisible();
  await expect(free).toBeVisible();
  // Nur Payware trägt ein Badge
  await expect(main.locator("article", { hasText: "Gelenkbus GL18 (fiktives Modell)" }).getByText("Payware", { exact: true })).toBeVisible();
  await expect(main.locator("article", { hasText: "Solobus SL12 (fiktives Modell)" }).getByText("Payware", { exact: true })).toHaveCount(0);

  await main.getByRole("link", { name: "Payware", exact: true }).click();
  await expect(page).toHaveURL(/\/de\/mods\/busse\?price=paid$/);
  await expect(paid).toBeVisible();
  await expect(free).toHaveCount(0);

  await main.getByRole("link", { name: "Freeware", exact: true }).click();
  await expect(page).toHaveURL(/price=free/);
  await expect(paid).toHaveCount(0);
  await expect(free).toBeVisible();

  // Zurücksetzen entfernt auch den Preisfilter
  await main.getByRole("link", { name: "Filter zurücksetzen" }).click();
  await expect(page).toHaveURL(/\/de\/mods\/busse$/);

  // Detailseite: Downloadbutton „Zum Shop“ und Hinweis
  await page.goto("/de/mods/gelenkbus-gl18");
  const downloadBox = page.getByRole("region", { name: "Download", exact: true });
  await expect(downloadBox.getByRole("link", { name: /^Zum Shop/ })).toHaveAttribute("href", /^\/go\/[a-z0-9]+$/);
  await expect(downloadBox.getByText(/^Kostenpflichtig – Kauf und Bezahlung/)).toBeVisible();
});

test("Detailseite kennzeichnet externe Downloads", async ({ page }) => {
  await page.goto("/de/mods/neustadt-am-kanal");
  const download = page.getByRole("link", { name: /Projektseite öffnen/ });
  await expect(download).toHaveAttribute("href", /^\/go\/[a-z0-9]+$/);
  await expect(download).toHaveAttribute("target", "_blank");
  await expect(download).toHaveAttribute("rel", /noopener/);
  await expect(page.getByText("Externes Ziel: example.com").first()).toBeVisible();
  await expect(page.getByText("Beispieldaten").first()).toBeVisible();
});

test("Titelbild und Screenshots stehen in einem Karussell", async ({ page }) => {
  await page.goto("/de/mods/neustadt-am-kanal");
  const carousel = page.getByRole("region", { name: "Titelbild und Screenshots" });
  // Titelbild plus zwei Screenshots, keine eigene Screenshot-Rubrik mehr
  await expect(carousel.getByRole("group", { name: /^Bild \d von 3$/ })).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Screenshots" })).toHaveCount(0);
  await expect(carousel.getByRole("img", { name: "Schematischer Linienplan einer fiktiven Stadt" })).toBeVisible();
  await expect(carousel.getByText("1 / 3")).toBeVisible();

  await carousel.getByRole("button", { name: "Nächstes Bild" }).click();
  await expect(carousel.getByText("2 / 3")).toBeVisible();
  await expect(carousel.getByRole("button", { name: "Bild 2 von 3 anzeigen" })).toHaveAttribute("aria-current", "true");
  await expect(carousel.getByRole("img", { name: "Landstraße mit Haltestelle in der Abenddämmerung" })).toBeInViewport();

  await carousel.getByRole("button", { name: "Bild 3 von 3 anzeigen" }).click();
  await expect(carousel.getByText("3 / 3")).toBeVisible();
  await expect(carousel.getByRole("img", { name: "Busdepot mit drei abgestellten Fahrzeugen" })).toBeInViewport();

  // Nach dem letzten Bild geht es von vorn los; Pfeiltasten funktionieren auch.
  await carousel.getByRole("button", { name: "Nächstes Bild" }).click();
  await expect(carousel.getByText("1 / 3")).toBeVisible();
  await carousel.getByRole("group", { name: "Bild 1 von 3" }).locator("..").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(carousel.getByText("3 / 3")).toBeVisible();
});

test("Impressum zeigt die Betreiberangaben, Entwürfe bleiben gekennzeichnet", async ({ page }) => {
  await page.goto("/de/legal/imprint");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Impressum");
  await expect(page.getByText("omsi-modhub – Tobias Schmidt")).toBeVisible();
  await expect(page.getByRole("link", { name: "Telefon: 04743/9501413" })).toHaveAttribute("href", "tel:+4947439501413");
  // AGPL-3.0 § 13: Quellcode ist von jeder Seite aus erreichbar
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Quellcode (AGPL-3.0)" })).toHaveAttribute(
    "href",
    "https://github.com/Tiegertosch/Omsi-Mod-Hub",
  );
  await expect(page.getByRole("link", { name: "kontakt@omsi-modhub.de" })).toHaveAttribute(
    "href",
    "mailto:kontakt@omsi-modhub.de",
  );
  await expect(page.getByRole("link", { name: "Kontaktformular bei Online-Impressum.de" })).toHaveAttribute(
    "href",
    "https://mein.online-impressum.de/omsi-modhub/#zweiterkontaktweg",
  );
  await expect(page.getByText("Entwurf", { exact: false })).toHaveCount(0);
});

test("Nutzungsbedingungen: geprüfte deutsche Fassung ohne Entwurfshinweis, englische Lesefassung", async ({ page }) => {
  await page.goto("/de/legal/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nutzungsbedingungen");
  await expect(page.getByText("Entwurf", { exact: false })).toHaveCount(0);
  // Kein „noindex“ mehr für die Nutzungsbedingungen
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveCount(10);
  await expect(page.getByRole("heading", { name: "9. Haftung und externe Seiten" })).toBeVisible();
  await expect(page.getByText("Ein Konto darfst du ab 16 Jahren anlegen.")).toBeVisible();

  await page.goto("/en/legal/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms of use");
  await expect(page.getByRole("heading", { name: "9. Liability and external websites" })).toBeVisible();
  await expect(page.getByText("Only the German version is legally binding.")).toBeVisible();
  await expect(page.getByText("This text is currently only available in German.")).toHaveCount(0);
});

test("Datenschutzerklärung wird aus der Datei dargestellt", async ({ page }) => {
  await page.goto("/de/legal/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Datenschutzerklärung");
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveCount(25);
  await expect(page.getByRole("heading", { name: "2. Name und Anschrift des Verantwortlichen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "b) Recht auf Auskunft" })).toBeVisible();
  await expect(page.getByText("omsi-modhub – Tobias Schmidt")).toBeVisible();
  await expect(page.getByText("c/o Online-Impressum 11973")).toBeVisible();
  // Konkrete Löschfristen als Liste
  await expect(page.getByRole("listitem").filter({ hasText: "Zugriffslogs: spätestens nach 14 Tagen." })).toBeVisible();
  // Cookie-Tabelle mit drei Zeilen
  const cookies = page.getByRole("main").getByRole("table");
  await expect(cookies.getByRole("columnheader")).toHaveText(["Cookie", "Zweck", "Dauer"]);
  await expect(cookies.getByRole("row")).toHaveCount(4);
  await expect(cookies.getByRole("cell", { name: "NEXT_LOCALE" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /^Nicht bestätigte Konten:/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fachanwälten für Internetrecht" })).toHaveAttribute("href", "https://www.wbs.legal/");
  await expect(page.getByText("Entwurf", { exact: false })).toHaveCount(0);
  await expect(page.getByText("**")).toHaveCount(0);

  // Englische Seite: eigene Fassung, kein Hinweis „nur Deutsch“
  await page.goto("/en/legal/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy policy");
  await expect(page.getByText("This text is currently only available in German.")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveCount(25);
  await expect(page.getByRole("heading", { level: 3, name: "a) Personal data" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("table").getByRole("columnheader")).toHaveText(["Cookie", "Purpose", "Duration"]);
});

test("Fallback-Hinweis bei fehlender Übersetzung", async ({ page }) => {
  await page.goto("/de/mods/midibus-citylink");
  await expect(page.getByText("keine deutsche Beschreibung")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAttribute("lang", "en");
});

test("Meldeformular speichert eine Meldung", async ({ page }) => {
  await page.goto("/de/mods/grenzland-ueberland");
  await page.getByText("Problem melden").click();
  await page.getByLabel("Grund").selectOption("BROKEN_LINK");
  await page.getByLabel("Beschreibung (optional)").fill("E2E-Test: Link führt ins Leere.");
  await page.getByRole("button", { name: "Meldung absenden" }).click();
  await expect(page.getByRole("status")).toContainText("Danke!");
});

test("Mobiles Menü öffnet die Navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/de");
  await page.getByRole("button", { name: "Menü öffnen" }).click();
  await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Creator" }).click();
  await expect(page).toHaveURL(/\/de\/creators$/);
  await expect(page.getByRole("button", { name: "Menü öffnen" })).toBeVisible();
});

test("Unbekannte Seiten zeigen die lokalisierte 404-Seite", async ({ page }) => {
  await page.goto("/en/mods/does-not-exist");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("Unbekannte Adressen liefern einen echten HTTP-404", async ({ page }) => {
  const notFound = [
    "/de/mods/gibt-es-nicht",
    "/de/mods/unveroeffentlichter-entwurf", // Entwurf ist nicht öffentlich
    "/en/creators/niemand-hier",
    "/de/legal/unbekannt",
    "/de/irgendwas/tief/verschachtelt",
  ];
  for (const path of notFound) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { name: /^(Seite nicht gefunden|Page not found)$/ })).toBeVisible();
  }
  for (const path of ["/de/mods/busse", "/de/mods/gelenkbus-gl18", "/de/creators/elbtal-busworks", "/de/legal/imprint"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
  }
});

test("Health-Check meldet eine erreichbare Datenbank", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({ status: "ok" });
});
