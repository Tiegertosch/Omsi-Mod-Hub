/**
 * Kopiert die Dateien des Cap-Widgets nach public/cap (siehe src/lib/cap-assets.ts):
 *
 *   pnpm cap:assets
 *
 * Danach die geänderten Dateien unter public/cap mit committen.
 */
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { CAP_ASSETS } from "../src/lib/cap-assets";

async function main() {
  for (const asset of CAP_ASSETS) {
    await mkdir(path.dirname(asset.to), { recursive: true });
    await copyFile(asset.from, asset.to);
    console.log(`${asset.from} → ${asset.to}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
