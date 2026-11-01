import { expect, test } from "@playwright/test";

import { randomIp, registerAndVerify, uniqueUser } from "./helpers";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

test("Cap: Widget und WebAssembly kommen von der eigenen Domain, die Anmeldung läuft durch", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const foreign: string[] = [];
  const capRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    // local.adguard.org: lokaler Werbeblocker auf dem Entwicklungsrechner, nicht die Seite
    if (url.protocol.startsWith("http") && url.origin !== origin && url.hostname !== "local.adguard.org") {
      foreign.push(request.url());
    }
    if (url.pathname.startsWith("/api/cap/") || url.pathname.startsWith("/cap/")) capRequests.push(url.pathname);
  });

  const user = uniqueUser("e2e-cap");
  await registerAndVerify(page, user);
  await page.context().clearCookies();

  await page.goto("/de/login");
  await page.getByLabel("E-Mail oder Benutzername").fill(user.username);
  await page.getByLabel("Passwort", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/de\/dashboard$/);

  expect(foreign).toEqual([]);
  expect(capRequests).toEqual(
    expect.arrayContaining([
      "/cap/load.js",
      "/cap/widget.js",
      "/cap/floating.js",
      "/api/cap/register/challenge",
      "/api/cap/register/redeem",
      "/api/cap/login/challenge",
      "/api/cap/login/redeem",
    ]),
  );
});

test("Cap: ohne JavaScript Hinweis und gesperrter Button, ohne Token lehnt der Server ab", async ({ page, request }) => {
  // Playwright schaltet JavaScript nur per Emulation ab, dabei bleibt <noscript>
  // unsichtbar; deshalb das ausgelieferte HTML prüfen.
  const html = await (await request.get("/de/forgot-password")).text();
  expect(html).toContain("<noscript>");
  expect(html).toContain("Dieses Formular braucht JavaScript");
  expect(html).toMatch(/<button type="submit" disabled=""[^>]*data-cap-floating="#cap-reset-/);

  // Absenden ohne Token: requestSubmit() umgeht den Klick, den der Floating-Modus abfängt.
  await page.goto("/de/forgot-password");
  const submit = page.getByRole("button", { name: "Link anfordern" });
  await expect(submit).toBeEnabled();
  await page.getByLabel("E-Mail-Adresse").fill(uniqueUser("e2e-cap-notoken").email);
  await page.locator("form").filter({ has: submit }).evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.getByText("Die Prüfung, ob du ein Mensch bist, ist fehlgeschlagen")).toBeVisible();
});

test("Cap: Endpunkte lehnen unbekannte Bereiche und falsche Lösungen ab", async ({ request }) => {
  const headers = { "x-forwarded-for": randomIp() };

  expect((await request.post("/api/cap/unbekannt/challenge", { headers })).status()).toBe(404);

  const challenge = await request.post("/api/cap/login/challenge", { headers });
  expect(challenge.status()).toBe(200);
  expect(challenge.headers()["cache-control"]).toContain("no-store");
  const { token, challenge: spec } = (await challenge.json()) as { token: string; challenge: { c: number } };
  expect(spec.c).toBeGreaterThan(0);

  // Falsche Lösung
  const wrong = await request.post("/api/cap/login/redeem", {
    headers,
    data: { token, solutions: Array.from({ length: spec.c }, () => 0) },
  });
  expect(wrong.status()).toBe(400);
  expect(await wrong.json()).toMatchObject({ success: false });

  // Challenge eines anderen Bereichs
  const otherScope = await request.post("/api/cap/report/redeem", {
    headers,
    data: { token, solutions: Array.from({ length: spec.c }, () => 0) },
  });
  expect(otherScope.status()).toBe(400);

  // Kaputter Körper
  const broken = await request.post("/api/cap/login/redeem", { headers, data: "kein json" });
  expect(broken.status()).toBe(400);
});
