import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generierter Prisma-Client
    "src/generated/**",
    // Kopierte, minifizierte Dateien des Cap-Widgets (src/lib/cap-assets.ts)
    "public/cap/widget.js",
    "public/cap/floating.js",
  ]),
]);

export default eslintConfig;
