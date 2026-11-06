import { expect, test, type Page } from "@playwright/test";

import {
  adminPage,
  becomeCreator,
  createSubmittableProject,
  openEditorTab,
  randomIp,
  registerAndVerify,
  uniqueUser,
  waitForMail,
} from "./helpers";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

async function publishedProject(page: Page, admin: Page, title: string) {
  const creator = uniqueUser("e2e-creator");
  await registerAndVerify(page, creator);
  await becomeCreator(page, "E2E Merkliste");
  const project = await createSubmittableProject(page, title);
  await page.getByRole("button", { name: "Zur Prüfung einreichen" }).click();
  await expect(page.getByText("In Prüfung", { exact: true })).toBeVisible();
  await admin.goto("/de/admin/projects");
  const item = admin.locator("li", { hasText: title });
  await item.getByRole("button", { name: "Freigeben" }).click();
  await expect(item).toHaveCount(0);
  return { ...project, creator };
}

async function addVersion(page: Page, projectId: string, version: string, changelog: string) {
  // Ohne Anker laden: Steht die Seite schon auf …/edit#versions, lädt goto sonst nicht neu.
  await page.goto(`/de/dashboard/projects/${projectId}/edit`);
  await openEditorTab(page, "Downloads");
  const form = page.locator("details", { hasText: "Neue Version" });
  await form.locator("summary").click();
  await form.getByLabel("Versionsnummer").fill(version);
  await form.getByLabel("Änderungen (Changelog)").fill(changelog);
  await form.getByLabel("URL").fill(`https://example.com/e2e-${version}`);
  await form.getByRole("button", { name: "Version anlegen" }).click();
  await expect(page.locator("summary", { hasText: version })).toBeVisible();
}

test("Merkliste: merken, Mail bei neuer Version, abbestellen, wieder einschalten, entfernen", async ({ page, browser }) => {
  const title = `E2E Gemerkt ${Date.now().toString(36)}`;
  const admin = await adminPage(browser);
  const project = await publishedProject(page, admin, title);

  // Gäste sehen einen Link zur Anmeldung, der zur Projektseite zurückführt.
  const guest = await browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const guestPage = await guest.newPage();
  await guestPage.goto(`/de/mods/${project.slug}`);
  const loginLink = guestPage.getByRole("link", { name: "Anmelden und merken" });
  await expect(loginLink).toHaveAttribute("href", new RegExp(`next=%2Fde%2Fmods%2F${project.slug}`));
  await guest.close();

  // Ein anderes Konto merkt sich das Projekt.
  const fanContext = await browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const fan = await fanContext.newPage();
  const fanUser = uniqueUser("e2e-fan");
  await registerAndVerify(fan, fanUser);
  await fan.goto(`/de/mods/${project.slug}`);
  await fan.getByRole("button", { name: "Projekt merken" }).click();
  await expect(fan.getByRole("button", { name: "Gemerkt – von der Merkliste entfernen" })).toBeVisible();
  await expect(fan.getByText("Du bekommst eine E-Mail, wenn eine neue Version erscheint.")).toBeVisible();

  await fan.goto("/de/dashboard/favorites");
  await expect(fan.getByRole("heading", { level: 1, name: "Merkliste" })).toBeVisible();
  await expect(fan.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await expect(fan.getByText("Bei neuen Versionen bekommst du eine E-Mail.")).toBeVisible();

  // Neue Version → Mail an das Konto mit Changelog und Abmeldelink.
  const since = Date.now();
  await addVersion(page, project.id, "1.1.0", "Neue Haltestellen <b>fett</b>");
  const mail = await waitForMail(fanUser.email, /^Neue Version: .* 1\.1\.0$/, since);
  expect(mail.subject).toContain(title);
  expect(mail.text).toContain("Neue Haltestellen <b>fett</b>");
  // Im HTML escaped, nie als Markup.
  expect(mail.html).toContain("Neue Haltestellen &lt;b&gt;fett&lt;/b&gt;");
  expect(mail.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  const oneClick = /^<(.+)>$/.exec(mail.headers?.["List-Unsubscribe"] ?? "")?.[1] ?? "";
  expect(oneClick).toMatch(/\/api\/unsubscribe\?u=.+&s=.+$/);
  const pageLink = /https?:\/\/\S+\/de\/unsubscribe\?\S+/.exec(mail.text)?.[0] ?? "";
  expect(pageLink).not.toBe("");

  // Ein-Klick-Abmeldung: GET ändert nichts, falsche Signatur wird abgewiesen.
  expect((await fan.request.post(oneClick.replace(/s=[^&]+/, "s=falsch"))).status()).toBe(400);
  expect((await fan.request.get(oneClick)).status()).toBe(405);

  // Abmeldeseite: erst der Knopf meldet ab.
  await fan.goto(pageLink);
  await expect(fan.getByRole("heading", { name: "Benachrichtigungen abbestellen" })).toBeVisible();
  await fan.goto("/de/dashboard/settings/account");
  await expect(fan.getByLabel("E-Mail, wenn ein gemerktes Projekt eine neue Version bekommt")).toBeChecked();
  await fan.goto(pageLink);
  await fan.getByRole("button", { name: "Abbestellen" }).click();
  await expect(fan.getByText("Erledigt. Du bekommst keine E-Mails mehr zu neuen Versionen.")).toBeVisible();

  const settings = fan.getByLabel("E-Mail, wenn ein gemerktes Projekt eine neue Version bekommt");
  await fan.goto("/de/dashboard/settings/account");
  await expect(settings).not.toBeChecked();
  await fan.goto(`/de/mods/${project.slug}`);
  await expect(fan.getByText("E-Mails bei neuen Versionen sind in deinen Einstellungen ausgeschaltet.")).toBeVisible();

  // Wieder einschalten, dann per Ein-Klick-Ziel (wie ein Mailprogramm) abmelden.
  await fan.goto("/de/dashboard/settings/account#notifications");
  await settings.check();
  await fan.getByRole("region", { name: "E-Mail-Benachrichtigungen" }).getByRole("button", { name: "Speichern" }).click();
  await expect(fan.getByText("Gespeichert.")).toBeVisible();
  await fan.reload();
  await expect(settings).toBeChecked();
  expect((await fan.request.post(oneClick, { form: { "List-Unsubscribe": "One-Click" } })).status()).toBe(200);
  await fan.reload();
  await expect(settings).not.toBeChecked();

  // Entfernen auf der Merkliste.
  await fan.goto("/de/dashboard/favorites");
  await fan.getByRole("button", { name: `Gemerkt – von der Merkliste entfernen: ${title}` }).click();
  await expect(fan.getByText("Du hast noch keine Projekte gemerkt.")).toBeVisible();
  await fanContext.close();
});

test("Keine Mail an Konten mit abgeschalteter Benachrichtigung und nicht an den Creator selbst", async ({ page, browser }) => {
  const title = `E2E Still ${Date.now().toString(36)}`;
  const admin = await adminPage(browser);
  const project = await publishedProject(page, admin, title);

  // Der Creator merkt sich das eigene Projekt.
  await page.goto(`/de/mods/${project.slug}`);
  await page.getByRole("button", { name: "Projekt merken" }).click();
  await expect(page.getByRole("button", { name: "Gemerkt – von der Merkliste entfernen" })).toBeVisible();

  // Ein Konto mit abgeschalteten Benachrichtigungen merkt es sich ebenfalls.
  const quietContext = await browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const quiet = await quietContext.newPage();
  const quietUser = uniqueUser("e2e-quiet");
  await registerAndVerify(quiet, quietUser);
  await quiet.goto("/de/dashboard/settings/account#notifications");
  await quiet.getByLabel("E-Mail, wenn ein gemerktes Projekt eine neue Version bekommt").uncheck();
  await quiet.getByRole("region", { name: "E-Mail-Benachrichtigungen" }).getByRole("button", { name: "Speichern" }).click();
  await expect(quiet.getByText("Gespeichert.")).toBeVisible();
  await quiet.goto(`/de/mods/${project.slug}`);
  await quiet.getByRole("button", { name: "Projekt merken" }).click();
  await expect(quiet.getByRole("button", { name: "Gemerkt – von der Merkliste entfernen" })).toBeVisible();

  const since = Date.now();
  await addVersion(page, project.id, "1.2.0", "Kleinigkeiten");
  await expect(waitForMail(quietUser.email, /^Neue Version/, since, 4000)).rejects.toThrow();
  await expect(waitForMail(project.creator.email, /^Neue Version/, since, 1000)).rejects.toThrow();
  await quietContext.close();
});
