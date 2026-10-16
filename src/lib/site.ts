export const siteConfig = {
  name: "OMSI Mod Hub",
  /** Basis-URL ohne abschließenden Slash */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
};
