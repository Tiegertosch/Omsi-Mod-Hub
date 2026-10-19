import { expect, test } from "@playwright/test";

import { becomeCreator, createSubmittableProject, randomIp, registerAndVerify, uniqueUser } from "./helpers";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

test("Content-Security-Policy: gesetzt, ohne Verstöße auf zentralen Seiten, fremde Skripte werden blockiert", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(`${page.url()}: ${message.text()}`);
  });

  const response = await page.goto("/de");
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("form-action 'self'");
  expect(csp).not.toContain("unsafe-eval");

  // Öffentliche Seiten, darunter Karussell, Filter, Suche und Formulare
  for (const path of [
    "/de/mods",
    "/de/mods/busse?price=paid",
    "/de/mods/neustadt-am-kanal",
    "/de/search?q=bus",
    "/de/creators",
    "/de/legal/terms",
    "/de/register",
    "/en/login",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  await page.goto("/de/mods/neustadt-am-kanal");
  await page.getByRole("region", { name: "Titelbild und Screenshots" }).getByRole("button", { name: /Nächstes Bild/ }).click();

  // Konto, Creator-Editor mit Tabs, Bild-Upload und Version (Server Actions, Bildauslieferung)
  await registerAndVerify(page, uniqueUser("e2e-creator"));
  await becomeCreator(page, "E2E CSP");
  await createSubmittableProject(page, `E2E CSP ${Date.now().toString(36)}`);
  await page.waitForLoadState("networkidle");

  expect(violations).toEqual([]);

  // Gegenprobe: Ein eingeschleustes fremdes Skript wird geblockt.
  const blocked = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        document.addEventListener("securitypolicyviolation", (event) => resolve(event.effectiveDirective), { once: true });
        const script = document.createElement("script");
        script.src = "https://example.com/fremd.js";
        document.head.append(script);
        setTimeout(() => resolve("nicht blockiert"), 3000);
      }),
  );
  expect(blocked).toBe("script-src-elem");
});
