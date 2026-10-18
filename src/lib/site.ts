export const siteConfig = {
  name: "OMSI Mod Hub",
  /** Basis-URL ohne abschließenden Slash */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  /** Quellcode (AGPL-3.0 § 13: Nutzer der Website müssen ihn erhalten können) */
  sourceUrl: "https://github.com/Tiegertosch/Omsi-Mod-Hub",
};
