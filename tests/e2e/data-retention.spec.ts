import { execSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { becomeCreator, login, randomIp, register, registerAndVerify, uniqueUser } from "./helpers";

const fixtures = (args: string) =>
  execSync(`pnpm exec tsx tests/e2e/support/retention-fixtures.ts ${args}`, { encoding: "utf8" }).trim();

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

test("Löschfristen: nie bestätigte Konten verschwinden nach 7 Tagen, jüngere bleiben", async ({ browser }) => {
  // Zwei Skriptaufrufe (tsx + Prisma) brauchen unter Windows je rund 10 Sekunden.
  test.setTimeout(120_000);
  const newContext = () =>
    browser.newContext({ locale: "de-DE", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });

  // Zwei Registrierungen ohne Bestätigung; eine davon ist „8 Tage alt“.
  const old = uniqueUser();
  const fresh = uniqueUser();
  for (const user of [old, fresh]) {
    const context = await newContext();
    await register(await context.newPage(), user);
    await context.close();
  }
  execSync(`pnpm exec tsx tests/e2e/support/age-account.ts ${old.email} 8`, { stdio: "pipe" });

  // Nur Testkonten anfassen – lokale Konten der Entwicklung bleiben unberührt.
  const output = execSync("pnpm data:cleanup --only-domain=e2e.example.com", { encoding: "utf8" });
  expect(output).toMatch(/Aufgeräumt: .*[1-9]\d* unbestätigte Konten/);

  // Das alte Konto existiert nicht mehr: Anmeldung schlägt als „falsche Zugangsdaten“ fehl.
  const oldContext = await newContext();
  const oldPage = await oldContext.newPage();
  await login(oldPage, old.username, old.password);
  await expect(oldPage.getByRole("alert").filter({ hasText: "E-Mail/Benutzername oder Passwort ist falsch." })).toBeVisible();
  await oldContext.close();

  // Das junge Konto ist noch da und landet wie gewohnt bei der Bestätigung.
  const freshContext = await newContext();
  const freshPage = await freshContext.newPage();
  await login(freshPage, fresh.username, fresh.password);
  await expect(freshPage).toHaveURL(/\/de\/confirm-email\?unverified=1$/);
  await freshContext.close();
});

test("Löschfristen: abgeschlossene Meldungen nach 6 Monaten, Protokoll nach 12 Monaten", async ({ page }) => {
  // Mehrere Skriptaufrufe (je rund 10 Sekunden unter Windows).
  test.setTimeout(180_000);
  const id = Date.now().toString(36);
  const oldReport = `E2E-Frist-alt-${id}`;
  const recentReport = `E2E-Frist-neu-${id}`;

  // Zwei Meldungen als Gast
  for (const text of [oldReport, recentReport]) {
    await page.goto("/de/mods/grenzland-ueberland");
    await page.getByText("Problem melden").click();
    await page.getByLabel("Grund").selectOption("BROKEN_LINK");
    await page.getByLabel("Beschreibung (optional)").fill(text);
    await page.getByRole("button", { name: "Meldung absenden" }).click();
    await expect(page.getByRole("status")).toContainText("Danke!");
  }
  // Eine vor 7 Monaten, eine vor 1 Monat abgeschlossen
  expect(fixtures(`close-report ${oldReport} 7`)).toBe("1");
  expect(fixtures(`close-report ${recentReport} 1`)).toBe("1");

  // Protokolleintrag: „Creator werden“ erzeugt einen; dieser wird 13 Monate alt.
  const user = uniqueUser("e2e-creator");
  await registerAndVerify(page, user);
  await becomeCreator(page, "E2E Fristen");
  expect(Number(fixtures(`age-audit ${user.email} 13`))).toBeGreaterThan(0);

  execSync("pnpm data:cleanup --only-domain=e2e.example.com", { encoding: "utf8" });

  expect(fixtures(`count-reports ${oldReport}`)).toBe("0");
  expect(fixtures(`count-reports ${recentReport}`)).toBe("1");
  expect(fixtures(`count-audit ${user.email}`)).toBe("0");
});
