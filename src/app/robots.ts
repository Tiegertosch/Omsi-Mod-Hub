import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const privatePaths = routing.locales.flatMap((locale) => [
    `/${locale}/dashboard`,
    `/${locale}/admin`,
    `/${locale}/search`,
    `/${locale}/login`,
    `/${locale}/register`,
  ]);
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/go/", "/api/", ...privatePaths] }],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
