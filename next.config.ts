import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Content-Security-Policy ohne Nonces (Next.js-Leitfaden „Without Nonces“):
 * Nonces erzwingen dynamisches Rendern jeder Seite und vertragen sich nicht
 * mit Partial Prerendering. Inline-Skripte bleiben daher erlaubt (Next.js
 * braucht sie für die Hydration); alles andere ist auf die eigene Herkunft
 * beschränkt – keine fremden Skripte, Verbindungen, Frames, Plugins oder
 * Formularziele. Schriften liefert next/font selbst aus, Bilder kommen aus
 * /_next/image, /media und /samples. 'unsafe-eval' nur für `next dev`.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Native Module bzw. Treiber mit optionalen nativen Teilen nicht bündeln.
  serverExternalPackages: ["sharp", "pg"],
  experimental: {
    // Bild-Uploads (max. 5 MB pro Datei) laufen über Server Actions; Standard wäre 1 MB.
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Interne Bereiche nie indexieren (zusätzlich zu robots.txt).
      {
        source: "/:locale(de|en)/:area(dashboard|admin)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
