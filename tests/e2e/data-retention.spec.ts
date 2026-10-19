import { execSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { login, randomIp, register, uniqueUser } from "./helpers";

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
