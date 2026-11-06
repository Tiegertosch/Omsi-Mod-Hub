import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * Produktion: `next start -H 127.0.0.1` hinter Caddy, das X-Forwarded-Proto:
 * https mitschickt. In dieser Kombination endete die 404-Umschreibung des
 * Proxys in einem 500 (siehe notFoundUrl() in src/proxy.ts). Der übrige
 * E2E-Server lauscht ohne -H, dort tritt der Fehler nicht auf; dieser Test
 * startet deshalb einen eigenen Server wie der systemd-Dienst.
 */
const PORT = Number(process.env.E2E_PROXY_PORT ?? 3100);
const BASE = `http://127.0.0.1:${PORT}`;
const CADDY_HEADERS = { "x-forwarded-proto": "https", "x-forwarded-host": "omsi-modhub.example", "x-forwarded-for": "203.0.113.7" };

test.describe.configure({ mode: "serial" });

let server: ChildProcess | undefined;

test.beforeAll(async () => {
  test.setTimeout(60_000);
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(PORT)], {
    env: { ...process.env, NODE_ENV: "production", MAIL_TRANSPORT: "file", DEV_MAIL_DIR: path.join(process.cwd(), ".e2e-mail") },
    stdio: "ignore",
  });
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {
      // startet noch
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server auf Port ${PORT} startet nicht (Port belegt?).`);
});

test.afterAll(() => {
  server?.kill();
});

test("Echter 404 auch hinter einem Reverse Proxy mit HTTPS (wie Caddy und systemd)", async ({ request }) => {
  for (const [path, heading] of [
    ["/de/mods/gibt-es-nicht", "Seite nicht gefunden"],
    ["/en/creators/niemand-hier", "Page not found"],
  ] as const) {
    const response = await request.get(`${BASE}${path}`, { headers: CADDY_HEADERS });
    expect(response.status(), path).toBe(404);
    expect(await response.text(), path).toContain(heading);
  }
  // Vorhandene Seiten bleiben unberührt.
  expect((await request.get(`${BASE}/de/mods/busse`, { headers: CADDY_HEADERS })).status()).toBe(200);
});
