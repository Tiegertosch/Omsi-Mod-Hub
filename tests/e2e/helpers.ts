import { execSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";

import { slugify } from "../../src/lib/slug";

export const E2E_MAIL_DOMAIN = "e2e.example.com";
const MAIL_DIR = path.join(process.cwd(), ".dev-mail");

export function uniqueUser(prefix = "e2e") {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const username = `${prefix}-${id}`;
  return { username, email: `${username}@${E2E_MAIL_DOMAIN}`, password: "E2E-Passwort-2026!" };
}

/** Zufällige IP pro Test, damit IP-basierte Rate-Limits Tests nicht gegenseitig blockieren. */
export function randomIp() {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;
}

type SentMail = { to: string; subject: string; text: string };

/** Wartet auf die neueste Mail an `to` (MAIL_TRANSPORT=file), deren Betreff passt. */
export async function waitForMail(to: string, subjectPattern: RegExp, since: number, timeoutMs = 15_000): Promise<SentMail> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // Dateinamen beginnen mit dem Zeitstempel (src/server/mail.ts): neueste zuerst,
      // ältere als `since` werden gar nicht erst gelesen.
      const files = (await readdir(MAIL_DIR)).filter((f) => f.endsWith(".json")).sort().reverse();
      for (const file of files) {
        if (Number.parseInt(file, 10) < since) break;
        const full = path.join(MAIL_DIR, file);
        const mail = JSON.parse(await readFile(full, "utf8")) as SentMail;
        if (mail.to === to && subjectPattern.test(mail.subject)) return mail;
      }
    } catch {
      // Ordner existiert evtl. noch nicht
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Keine Mail an ${to} gefunden.`);
}

/** Wie waitForMail, liefert aber den enthaltenen Link. */
export async function waitForMailLink(to: string, subjectPattern: RegExp, since: number): Promise<string> {
  const mail = await waitForMail(to, subjectPattern, since);
  const link = /https?:\/\/\S+/.exec(mail.text)?.[0];
  if (!link) throw new Error(`Mail an ${to} enthält keinen Link.`);
  return link;
}

export async function register(page: Page, user: ReturnType<typeof uniqueUser>) {
  await page.goto("/de/register");
  await page.getByLabel("Benutzername").fill(user.username);
  await page.getByLabel("E-Mail-Adresse").fill(user.email);
  await page.getByLabel("Passwort", { exact: true }).fill(user.password);
  await page.getByLabel("Passwort wiederholen").fill(user.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page).toHaveURL(/\/de\/confirm-email$/);
  await expect(page.getByRole("heading", { name: "E-Mail-Adresse bestätigen" })).toBeVisible();
}

/** Wartet auf die neueste Mail mit Bestätigungscode an `to` und liefert den Code. */
export async function waitForMailCode(to: string, since: number): Promise<string> {
  const mail = await waitForMail(to, /Bestätigungscode/, since);
  const code = /^(\d{6}) /.exec(mail.subject)?.[1];
  if (!code || !mail.text.includes(code)) throw new Error(`Mail an ${to} enthält keinen Code.`);
  return code;
}

/** Gibt auf der Code-Seite einen Code ein (die Adresse ist vorausgefüllt). */
export async function enterCode(page: Page, code: string) {
  await page.getByLabel("Bestätigungscode").fill(code);
  await page.getByRole("button", { name: "Bestätigen", exact: true }).click();
}

/** Registriert, bestätigt die E-Mail mit dem Code und ist danach angemeldet. */
export async function registerAndVerify(page: Page, user: ReturnType<typeof uniqueUser>) {
  const since = Date.now() - 1000;
  await register(page, user);
  await enterCode(page, await waitForMailCode(user.email, since));
  await expect(page).toHaveURL(/\/de\/dashboard$/);
}

export async function login(page: Page, identifier: string, password: string) {
  await page.goto("/de/login");
  await page.getByLabel("E-Mail oder Benutzername").fill(identifier);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
}

export async function testPng(width = 800, height = 450) {
  return sharp({ create: { width, height, channels: 3, background: "#2b6cb0" } }).png().toBuffer();
}

export async function becomeCreator(page: Page, displayName: string) {
  await page.goto("/de/dashboard/projects");
  await expect(page.getByRole("heading", { name: "Creator werden" })).toBeVisible();
  await page.getByLabel("Öffentlicher Name").fill(displayName);
  await page.getByRole("button", { name: "Creator-Profil anlegen" }).click();
  await expect(page.getByRole("heading", { name: "Noch keine Projekte" })).toBeVisible();
}

/** Legt ein Projekt mit Titelbild und Version an; liefert ID und Slug. */
export async function createSubmittableProject(page: Page, title: string) {
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

/** Neuer Browser-Kontext mit frisch registriertem Admin (Rolle per CLI). */
export async function createAdmin(browser: Browser) {
  const context = await browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const page = await context.newPage();
  const user = uniqueUser("e2e-admin");
  await registerAndVerify(page, user);
  execSync(`pnpm user:set-role ${user.email} admin`, { stdio: "pipe" });
  return { page, user };
}

export async function adminPage(browser: Browser) {
  return (await createAdmin(browser)).page;
}
