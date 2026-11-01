import { expect, test, type Browser, type Page } from "@playwright/test";

import {
  becomeCreator,
  createAdmin,
  createSubmittableProject,
  login,
  randomIp,
  registerAndVerify,
  uniqueUser,
  waitForMail,
  waitForMailLink,
} from "./helpers";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Creator legt ein Projekt an und reicht es ein, ein Admin gibt es frei. */
async function publishedProject(page: Page, browser: Browser) {
  const creator = uniqueUser("e2e-creator");
  await registerAndVerify(page, creator);
  await becomeCreator(page, "E2E Moderation");
  const title = `E2E Moderation ${uid()}`;
  const project = await createSubmittableProject(page, title);
  await page.getByRole("button", { name: "Zur Prüfung einreichen" }).click();
  await expect(page.getByText("In Prüfung", { exact: true })).toBeVisible();

  const admin = await createAdmin(browser);
  await admin.page.goto("/de/admin/projects");
  const item = admin.page.locator("li", { hasText: title });
  await item.getByRole("button", { name: "Freigeben" }).click();
  await expect(item).toHaveCount(0);
  return { creator, title, project, admin };
}

test("Ausblenden mit Begründung, Benachrichtigung und Wiedereinblenden", async ({ page, browser }) => {
  const since = Date.now() - 1000;
  const { creator, title, project, admin } = await publishedProject(page, browser);
  await waitForMailLink(creator.email, /Freigegeben/, since);

  await admin.page.goto("/de/admin/projects?status=PUBLISHED");
  const published = admin.page.locator("li", { hasText: title });
  await published.locator("summary", { hasText: "Ausblenden" }).click();
  await published.getByRole("button", { name: "Ausblenden" }).click();
  await expect(published.getByText("Dieses Feld ist erforderlich.")).toBeVisible();
  await published.getByLabel("Begründung für den Creator").fill("E2E: Downloadlink wird geprüft.");
  await published.getByRole("button", { name: "Ausblenden" }).click();
  await expect(published).toHaveCount(0);

  // Nicht mehr öffentlich (echter 404)
  const hiddenResponse = await page.goto(`/de/mods/${project.slug}`);
  expect(hiddenResponse?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();

  // Creator erhält eine Mail mit Link ins Dashboard und sieht dort die Begründung
  const link = await waitForMailLink(creator.email, /Ausgeblendet/, since);
  expect(link).toMatch(new RegExp(`/de/dashboard/projects/${project.id}/edit$`));
  await page.goto(link);
  await expect(page.getByText("Ausgeblendet", { exact: true })).toBeVisible();
  await expect(page.getByText("E2E: Downloadlink wird geprüft.")).toBeVisible();

  await admin.page.goto("/de/admin/projects?status=HIDDEN");
  const hidden = admin.page.locator("li", { hasText: title });
  await hidden.getByRole("button", { name: "Wieder einblenden" }).click();
  await expect(hidden).toHaveCount(0);

  await page.goto(`/de/mods/${project.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await waitForMailLink(creator.email, /Wieder sichtbar/, since);
});

test("Widerspruch gegen das Ausblenden: Link aus der Mail, Stattgeben veröffentlicht wieder", async ({ page, browser }) => {
  const since = Date.now() - 1000;
  const { creator, title, project, admin } = await publishedProject(page, browser);

  await admin.page.goto("/de/admin/projects?status=PUBLISHED");
  const published = admin.page.locator("li", { hasText: title });
  await published.locator("summary", { hasText: "Ausblenden" }).click();
  await published.getByLabel("Begründung für den Creator").fill("E2E: Lizenz unklar.");
  await published.getByRole("button", { name: "Ausblenden" }).click();
  await expect(published).toHaveCount(0);

  // Die Mail enthält Frist und geheimen Widerspruchslink
  const mail = await waitForMail(creator.email, /Ausgeblendet/, since);
  const appealUrl = /https?:\/\/\S+\/de\/appeal\?token=[A-Za-z0-9_-]{43}/.exec(mail.text)?.[0];
  expect(appealUrl, mail.text).toBeTruthy();
  expect(mail.text).toContain("widersprechen");

  // Kein Login nötig: eigener Browser-Kontext ohne Sitzung
  const guest = await browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const guestPage = await guest.newPage();
  await guestPage.goto(appealUrl!);
  await expect(guestPage.getByText("E2E: Lizenz unklar.")).toBeVisible();
  await expect(guestPage.getByText("Projekt ausgeblendet")).toBeVisible();
  await guestPage.getByRole("button", { name: "Widerspruch einreichen" }).click();
  await expect(guestPage.getByText("Bitte gib eine Begründung ein")).toBeVisible();
  await guestPage.getByLabel("Deine Begründung").fill("E2E: Die Lizenz steht in der Beschreibung.");
  await guestPage.getByRole("button", { name: "Widerspruch einreichen" }).click();
  await expect(guestPage.getByText(/wird geprüft|ist eingegangen/)).toBeVisible();

  // Ein manipulierter Link zeigt nur einen Hinweis
  await guestPage.goto(appealUrl!.replace(/token=(.)/, (_, first) => `token=${first === "A" ? "B" : "A"}`));
  await expect(guestPage.getByText("Dieser Link ist ungültig.")).toBeVisible();

  // Admin entscheidet; ohne Begründung geht es nicht
  await admin.page.goto("/de/admin/appeals");
  const appeal = admin.page.locator("li", { hasText: title });
  await expect(appeal.getByText("E2E: Die Lizenz steht in der Beschreibung.")).toBeVisible();
  await appeal.getByRole("button", { name: "Stattgeben" }).click();
  await expect(appeal.getByText("Dieses Feld ist erforderlich.")).toBeVisible();
  await appeal.getByLabel("Begründung (geht per E-Mail an den Creator)").fill("E2E: Stimmt, Lizenz vorhanden.");
  await appeal.getByRole("button", { name: "Stattgeben" }).click();
  await expect(appeal).toHaveCount(0);

  // Wieder öffentlich, Creator erhält das Ergebnis, der Link zeigt den Abschluss
  await page.goto(`/de/mods/${project.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  const result = await waitForMail(creator.email, /Widerspruch erfolgreich/, since);
  expect(result.text).toContain("E2E: Stimmt, Lizenz vorhanden.");
  await guestPage.goto(appealUrl!);
  await expect(guestPage.getByText(/stattgegeben/)).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "Widerspruch einreichen" })).toHaveCount(0);
  await guest.close();
});

test("Meldung bearbeiten, mit Notiz abschließen und im Protokoll finden", async ({ page, browser }) => {
  const { project, admin } = await publishedProject(page, browser);
  const description = `E2E-Meldung ${uid()}: Link führt ins Leere.`;

  // Meldung als Gast
  const guest = await browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const guestPage = await guest.newPage();
  await guestPage.goto(`/de/mods/${project.slug}`);
  await guestPage.getByText("Problem melden").click();
  await guestPage.getByLabel("Grund").selectOption("BROKEN_LINK");
  await guestPage.getByLabel("Beschreibung (optional)").fill(description);
  await guestPage.getByRole("button", { name: "Meldung absenden" }).click();
  await expect(guestPage.getByRole("status")).toContainText("Danke!");
  await guest.close();

  await admin.page.goto("/de/admin/reports");
  const open = admin.page.locator("li", { hasText: description });
  await expect(open.getByText("Gemeldet von Gast")).toBeVisible();
  await open.getByRole("button", { name: "In Bearbeitung nehmen" }).click();
  await expect(open).toHaveCount(0);

  await admin.page.goto("/de/admin/reports?status=IN_REVIEW");
  const inReview = admin.page.locator("li", { hasText: description });
  await inReview.getByLabel("Interne Notiz (optional)").fill("Ersatzlink beim Creator angefragt.");
  await inReview.getByRole("button", { name: "Als erledigt markieren" }).click();
  await expect(inReview).toHaveCount(0);

  await admin.page.goto("/de/admin/reports?status=RESOLVED");
  const resolved = admin.page.locator("li", { hasText: description });
  await expect(resolved.getByText("Ersatzlink beim Creator angefragt.")).toBeVisible();
  await expect(resolved.getByText(`Abgeschlossen von @${admin.user.username}`)).toBeVisible();
  await expect(resolved.getByRole("button", { name: "Wieder öffnen" })).toBeVisible();

  await admin.page.goto("/de/admin/audit");
  const row = admin.page.locator("tr", { hasText: "report.resolve" }).filter({ hasText: `@${admin.user.username}` });
  await expect(row.first()).toBeVisible();
});

test("Sperren beendet Sitzungen und verhindert die Anmeldung bis zur Aufhebung", async ({ page, browser }) => {
  const since = Date.now() - 1000;
  const user = uniqueUser();
  await registerAndVerify(page, user);
  const admin = await createAdmin(browser);

  // Eigenes Konto ist geschützt
  await admin.page.goto(`/de/admin/users?q=${admin.user.username}`);
  await expect(admin.page.getByText("Das ist dein eigenes Konto.")).toBeVisible();

  await admin.page.goto(`/de/admin/users?q=${user.username}`);
  const item = admin.page.locator("li", { hasText: `@${user.username}` });
  await item.locator("summary", { hasText: "Konto sperren" }).click();
  await item.getByRole("button", { name: `@${user.username} sperren` }).click();
  await expect(item.getByText("Dieses Feld ist erforderlich.")).toBeVisible();
  await item.getByLabel("Grund der Sperre").fill("E2E: Spam in Meldungen.");
  await item.getByLabel("Dauer").selectOption("1d");
  await item.getByRole("button", { name: `@${user.username} sperren` }).click();
  await expect(item.getByText("gesperrt", { exact: true })).toBeVisible();
  await expect(item.getByText(/Gesperrt bis/)).toBeVisible();

  // Das Konto erfährt Grund und Dauer per E-Mail
  const banMail = await waitForMail(user.email, /Konto wurde gesperrt/, since);
  expect(banMail.text).toContain("E2E: Spam in Meldungen.");
  expect(banMail.text).toContain("bis zum");

  // Die bestehende Sitzung ist beendet …
  await page.goto("/de/dashboard");
  await expect(page).toHaveURL(/\/de\/login\?next=/);
  // … und eine neue Anmeldung wird abgelehnt.
  await login(page, user.email, user.password);
  await expect(page.getByRole("alert").filter({ hasText: "Dieses Konto ist gesperrt." })).toBeVisible();

  await item.getByRole("button", { name: "Sperre aufheben" }).click();
  await expect(item.getByRole("button", { name: "Sperre aufheben" })).toHaveCount(0);

  await login(page, user.email, user.password);
  await expect(page).toHaveURL(/\/de\/dashboard$/);
});

test("Kategorien und Tags anlegen, umbenennen und löschen", async ({ browser }) => {
  const { page } = await createAdmin(browser);
  const slug = `e2e-${uid()}`;

  // Tag anlegen
  await page.goto("/de/admin/tags");
  await page.locator("#tag-new-slug").fill(slug);
  await page.locator("#tag-new-de-name").fill("E2E Schlagwort");
  await page.locator("#tag-new-en-name").fill("E2E keyword");
  await page.getByRole("button", { name: "Tag anlegen" }).click();
  const tag = page.locator("li", { hasText: slug });
  await expect(tag).toBeVisible();
  await expect(page.locator("#tag-new-slug")).toHaveValue("");

  // Doppelter Slug wird abgelehnt
  await page.locator("#tag-new-slug").fill(slug);
  await page.locator("#tag-new-de-name").fill("Doppelt");
  await page.locator("#tag-new-en-name").fill("Duplicate");
  await page.getByRole("button", { name: "Tag anlegen" }).click();
  await expect(page.getByText("Dieses Kürzel ist bereits vergeben")).toBeVisible();

  // Umbenennen
  await tag.locator("summary").first().click();
  await tag.getByLabel("Name (Deutsch)").fill("E2E Umbenannt");
  await tag.getByRole("button", { name: "Speichern" }).click();
  await expect(tag.getByText("Gespeichert.")).toBeVisible();
  await expect(tag.locator("summary").first()).toContainText("E2E Umbenannt");

  // Löschen
  await tag.locator("summary", { hasText: "Löschen" }).click();
  await tag.getByRole("button", { name: "Endgültig löschen" }).click();
  await expect(tag).toHaveCount(0);

  // Kategorie: Kürzel eines bestehenden Projekts ist reserviert
  await page.goto("/de/admin/categories");
  await page.locator("#category-new-slug").fill("gelenkbus-gl18");
  await page.locator("#category-new-de-name").fill("Kollision");
  await page.locator("#category-new-en-name").fill("Collision");
  await page.getByRole("button", { name: "Kategorie anlegen" }).click();
  await expect(page.getByText("Dieses Kürzel ist bereits vergeben")).toBeVisible();

  await page.locator("#category-new-slug").fill(slug);
  await page.locator("#category-new-de-name").fill("E2E Haltestellen");
  await page.locator("#category-new-en-name").fill("E2E bus stops");
  await page.locator("#category-new-icon").selectOption("map");
  await page.getByRole("button", { name: "Kategorie anlegen" }).click();
  const category = page.locator("li", { hasText: `/mods/${slug}` });
  await expect(category).toBeVisible();

  // Öffentlich erreichbar, solange sie existiert; Umbenennen wirkt sofort
  const visitor = await browser.newPage();
  await visitor.goto(`/de/mods/${slug}`);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("E2E Haltestellen");
  await category.locator("summary").first().click();
  await category.getByLabel("Name (Deutsch)").fill("E2E Wartehallen");
  await category.getByRole("button", { name: "Speichern" }).click();
  await expect(category.getByText("Gespeichert.")).toBeVisible();
  await visitor.goto(`/de/mods/${slug}`);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("E2E Wartehallen");

  await category.locator("summary", { hasText: "Löschen" }).click();
  await category.getByRole("button", { name: "Endgültig löschen" }).click();
  await expect(category).toHaveCount(0);

  const gone = await visitor.goto(`/de/mods/${slug}`);
  expect(gone?.status()).toBe(404);
  await expect(visitor.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
  await visitor.close();
});

test("Admin-Unterseiten sind für normale Nutzer nicht erreichbar", async ({ page }) => {
  await registerAndVerify(page, uniqueUser());
  for (const path of ["/de/admin/reports", "/de/admin/users", "/de/admin/categories", "/de/admin/tags", "/de/admin/audit"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Adminbereich" })).toHaveCount(0);
  }
});
