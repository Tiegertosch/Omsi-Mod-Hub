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
      "/api/cap/register/challenge",
      "/api/cap/register/redeem",
      "/api/cap/login/challenge",
      "/api/cap/login/redeem",
    ]),
  );
});

test("Cap: Enter schickt die Anmeldung ab, auch bevor das Widget geladen ist", async ({ page }) => {
  const user = uniqueUser("e2e-cap-enter");
  await registerAndVerify(page, user);
  await page.context().clearCookies();

  // Langsames Laden nachstellen (z. B. Passwortmanager füllt sofort aus).
  await page.route("**/cap/load.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });
  await page.goto("/de/login");
  await page.getByLabel("E-Mail oder Benutzername").fill(user.email);
  await page.getByLabel("Passwort", { exact: true }).fill(user.password);
  expect(await page.evaluate(() => window.__omsiCapReady === true)).toBe(false);
  await page.getByLabel("Passwort", { exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "Wird geprüft …" })).toBeVisible();
  await expect(page).toHaveURL(/\/de\/dashboard$/);
});

test("Cap: ohne JavaScript Hinweis und gesperrter Button, ohne Token lehnt der Server ab", async ({ page, request }) => {
  // Playwright schaltet JavaScript nur per Emulation ab, dabei bleibt <noscript>
  // unsichtbar; deshalb das ausgelieferte HTML prüfen.
  const html = await (await request.get("/de/forgot-password")).text();
  expect(html).toContain("<noscript>");
  expect(html).toContain("Dieses Formular braucht JavaScript");
  expect(html).toMatch(/<button type="submit" disabled=""[^>]*>Link anfordern<\/button>/);

  // Absenden ohne Token: requestSubmit() umgeht den Klick, der die Prüfung auslöst.
  await page.goto("/de/forgot-password");
  const submit = page.getByRole("button", { name: "Link anfordern" });
  await expect(submit).toBeEnabled();
  await page.getByLabel("E-Mail-Adresse").fill(uniqueUser("e2e-cap-notoken").email);
  await page.locator("form").filter({ has: submit }).evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.getByText("Die Prüfung, ob du ein Mensch bist, ist fehlgeschlagen")).toBeVisible();
});

test("Cap: Prüfung läuft im Button, wiederholtes Klicken startet sie nicht neu und sendet nur einmal ab", async ({ page }) => {
  const counts = { challenge: 0, redeem: 0, action: 0 };
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname === "/api/cap/reset/challenge") counts.challenge++;
    if (pathname === "/api/cap/reset/redeem") counts.redeem++;
    if (request.method() === "POST" && request.headers()["next-action"]) counts.action++;
  });

  // Einlösen verzögern, damit der Zwischenzustand im Button sicher sichtbar ist
  await page.route("**/api/cap/reset/redeem", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.goto("/de/forgot-password");
  const submit = page.getByRole("button", { name: "Link anfordern" });
  await expect(submit).toBeEnabled();
  await page.getByLabel("E-Mail-Adresse").fill(uniqueUser("e2e-cap-spam").email);
  // Fünf Klicks direkt hintereinander, wie beim schnellen Mehrfachklicken
  await submit.evaluate((button: HTMLButtonElement) => {
    for (let i = 0; i < 5; i++) button.click();
  });
  // Die Prüfung läuft sichtbar im Button, ein Widget erscheint nicht
  await expect(page.getByRole("button", { name: "Wird geprüft …" })).toBeDisabled();
  await expect(page.locator("cap-widget")).toBeHidden();
  await expect(page.getByText("Falls ein Konto mit dieser Adresse existiert")).toBeVisible();
  // Ein weiterer Klick in der Zwischenzeit hätte eine neue Challenge geholt
  await page.waitForTimeout(1000);
  expect(counts).toEqual({ challenge: 1, redeem: 1, action: 1 });
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
