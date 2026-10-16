import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

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

/** Wartet auf die neueste Mail an `to` (MAIL_TRANSPORT=file) und liefert den enthaltenen Link. */
export async function waitForMailLink(to: string, subjectPattern: RegExp, since: number): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const files = (await readdir(MAIL_DIR)).filter((f) => f.endsWith(".json")).sort().reverse();
      for (const file of files) {
        const full = path.join(MAIL_DIR, file);
        if ((await stat(full)).mtimeMs < since) continue;
        const mail = JSON.parse(await readFile(full, "utf8")) as { to: string; subject: string; text: string };
        if (mail.to === to && subjectPattern.test(mail.subject)) {
          const link = /https?:\/\/\S+/.exec(mail.text)?.[0];
          if (link) return link;
        }
      }
    } catch {
      // Ordner existiert evtl. noch nicht
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Keine Mail an ${to} gefunden.`);
}

export async function register(page: Page, user: ReturnType<typeof uniqueUser>) {
  await page.goto("/de/register");
  await page.getByLabel("Benutzername").fill(user.username);
  await page.getByLabel("E-Mail-Adresse").fill(user.email);
  await page.getByLabel("Passwort", { exact: true }).fill(user.password);
  await page.getByLabel("Passwort wiederholen").fill(user.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page.getByRole("heading", { name: "Fast geschafft!" })).toBeVisible();
}

/** Registriert, bestätigt die E-Mail über den Link und ist danach angemeldet. */
export async function registerAndVerify(page: Page, user: ReturnType<typeof uniqueUser>) {
  const since = Date.now() - 1000;
  await register(page, user);
  const link = await waitForMailLink(user.email, /bestätige/i, since);
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "E-Mail bestätigt" })).toBeVisible();
}

export async function login(page: Page, identifier: string, password: string) {
  await page.goto("/de/login");
  await page.getByLabel("E-Mail oder Benutzername").fill(identifier);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
}
