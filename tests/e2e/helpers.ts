import { execSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, type Browser, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

import { slugify } from "../../src/lib/slug";

export const E2E_MAIL_DOMAIN = "e2e.example.com";
// Wie E2E_MAIL_DIR in playwright.config.ts (dorthin schreibt der Testserver).
const MAIL_DIR = path.join(process.cwd(), ".e2e-mail");

export function uniqueUser(prefix = "e2e") {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const username = `${prefix}-${id}`;
  return { username, email: `${username}@${E2E_MAIL_DOMAIN}`, password: "E2E-Passwort-2026!" };
}

/** Zufällige IP pro Test, damit IP-basierte Rate-Limits Tests nicht gegenseitig blockieren. */
export function randomIp() {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;
}

type SentMail = { to: string; subject: string; text: string; html?: string; headers?: Record<string, string> };

/** Wartet auf die neueste Mail an `to` (MAIL_TRANSPORT=file), deren Betreff passt. */
export async function waitForMail(to: string, subjectPattern: RegExp, since: number, timeoutMs = 15_000): Promise<SentMail> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // Dateinamen beginnen mit dem Zeitstempel (src/server/mail-transport.ts): neueste zuerst,
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

/** Die sechs Ziffernfelder der Code-Seite. */
export function codeFields(page: Page) {
  return page.getByRole("group", { name: "Bestätigungscode" }).getByRole("textbox");
}

/**
 * Gibt auf der Code-Seite einen Code ein (die Adresse ist bekannt). `fill` ins
 * erste Feld entspricht Einfügen bzw. Autofill und verteilt den Code.
 */
export async function enterCode(page: Page, code: string) {
  await codeFields(page).first().fill(code);
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
/** Öffnet einen Tab des Projekt-Editors (der Name kann einen Fehlerhinweis tragen). */
export async function openEditorTab(page: Page, name: string) {
  const tab = page.getByRole("tablist", { name: "Bereiche des Projekts" }).getByRole("tab", { name: new RegExp(`^${name}`) });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

/** Deutsche Texte im Tab „Beschreibung“ (innerer Sprach-Tab). */
export function germanTexts(page: Page) {
  return page.getByRole("tabpanel", { name: "Deutsch" });
}

export async function createSubmittableProject(page: Page, title: string) {
  await page.goto("/de/dashboard/projects/new");
  await page.getByLabel(/^Kategorie/).selectOption({ label: "Busse & Fahrzeuge" });
  await page.getByLabel(/^Lizenz/).fill("Private Nutzung erlaubt");
  await openEditorTab(page, "Beschreibung");
  await germanTexts(page).getByLabel("Titel", { exact: true }).fill(title);
  await germanTexts(page).getByLabel("Kurzbeschreibung").fill("Ein Testbus aus dem E2E-Test.");
  await germanTexts(page).getByRole("textbox", { name: "Beschreibung", exact: true }).fill("Ausführliche Beschreibung.\n\nZweiter Absatz.");
  await page.getByRole("button", { name: "Projekt anlegen" }).click();
  // Nach dem Anlegen geht es direkt im Tab „Bilder“ weiter.
  await expect(page).toHaveURL(/\/de\/dashboard\/projects\/[a-z0-9]+\/edit#media$/);
  await expect(page.getByRole("tab", { name: "Bilder" })).toHaveAttribute("aria-selected", "true");
  const id = /projects\/([a-z0-9]+)\/edit/.exec(page.url())?.[1] ?? "";

  await expect(page.getByRole("button", { name: "Zur Prüfung einreichen" })).toBeDisabled();

  await page.locator("#cover-upload-file").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: await testPng() });
  await page.locator("#cover-upload-alt").fill("Blauer Testbus");
  await page.getByRole("button", { name: "Titelbild hochladen" }).click();
  await expect(page.getByText("Bild gespeichert.")).toBeVisible();

  // Offene Punkte der Checkliste führen zum passenden Tab.
  await page.getByRole("link", { name: "Mindestens eine Version" }).click();
  await expect(page.getByRole("tab", { name: "Downloads" })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/#versions$/);
  const newVersion = page.locator("details", { hasText: "Neue Version" });
  await newVersion.getByLabel("Versionsnummer").fill("1.0.0");
  await newVersion.getByLabel("URL").fill("https://example.com/e2e-download");
  await newVersion.getByRole("button", { name: "Version anlegen" }).click();
  await expect(page.locator("summary", { hasText: "1.0.0" })).toBeVisible();

  return { id, slug: slugify(title) };
}

/** Füllt eine Ziffern-Eingabe (CodeInput); Einfügen ins erste Feld verteilt den Code. */
export async function fillDigits(scope: Page | Locator, label: string, code: string) {
  await scope.getByRole("group", { name: label }).getByRole("textbox").first().fill(code);
}

/** Base32 (RFC 4648) wie im otpauth-Link der Authenticator-Apps. */
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of input.replace(/[\s=]/g, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error(`Ungültiges Base32-Zeichen: ${char}`);
    value = ((value << 5) | index) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** TOTP nach RFC 6238 (SHA-1, 6 Ziffern, 30 Sekunden) – wie eine Authenticator-App. */
export function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}

/**
 * Richtet in den Einstellungen die Zwei-Faktor-Anmeldung ein (angemeldet).
 * Liefert das Secret (für weitere Codes) und die Backup-Codes.
 */
export async function enableTwoFactor(page: Page, password: string) {
  await page.goto("/de/dashboard/settings/security");
  const section = page.getByRole("region", { name: "Zwei-Faktor-Anmeldung" });
  await section.getByLabel("Aktuelles Passwort").fill(password);
  await section.getByRole("button", { name: "Zwei-Faktor-Anmeldung einrichten" }).click();
  const secretText = await section.getByTestId("totp-secret").textContent();
  const secret = (secretText ?? "").replace(/\s/g, "");
  const backupCodes = await section.getByRole("list", { name: "Backup-Codes" }).getByRole("listitem").allTextContents();
  await fillDigits(section, "Code aus der App", totp(secret));
  await section.getByRole("button", { name: "Bestätigen und einschalten" }).click();
  await expect(section.getByText("Die Zwei-Faktor-Anmeldung ist aktiv.")).toBeVisible();
  return { secret, backupCodes };
}

/** Neuer Browser-Kontext mit frisch registriertem Admin (Rolle per CLI, 2FA eingerichtet). */
export async function createAdmin(browser: Browser) {
  const context = await browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const page = await context.newPage();
  const user = uniqueUser("e2e-admin");
  await registerAndVerify(page, user);
  execSync(`pnpm user:set-role ${user.email} admin`, { stdio: "pipe" });
  // Admin-Rechte gelten erst mit Zwei-Faktor-Anmeldung.
  const twoFactor = await enableTwoFactor(page, user.password);
  return { page, user, twoFactor };
}

export async function adminPage(browser: Browser) {
  return (await createAdmin(browser)).page;
}

/** Setzt die gespeicherte Zustimmung zu den Nutzungsbedingungen eines Testkontos (null = keine). */
export function setTermsVersion(email: string, version: string | null) {
  execSync(`pnpm exec tsx tests/e2e/support/set-terms-version.ts ${email} ${version ?? "null"}`, { stdio: "pipe" });
}
