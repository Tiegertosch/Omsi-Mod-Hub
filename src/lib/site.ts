export const siteConfig = {
  name: "OMSI Mod Hub",
  /** Basis-URL ohne abschließenden Slash */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  /** Quellcode (AGPL-3.0 § 13: Nutzer der Website müssen ihn erhalten können) */
  sourceUrl: "https://github.com/Tiegertosch/Omsi-Mod-Hub",
};

/**
 * Name, mit dem sich der Server beim SMTP-Server meldet (EHLO). Ohne Angabe
 * nähme nodemailer den Rechnernamen bzw. „[127.0.0.1]“, was Spamfilter
 * (z. B. GMX) negativ werten können. Der Host der Website zeigt auf denselben
 * Server. `undefined` bei localhost oder ungültiger URL (Entwicklung).
 */
export function smtpHeloName(siteUrl: string): string | undefined {
  try {
    const { hostname } = new URL(siteUrl);
    return hostname.includes(".") && !/^[\d.]+$/.test(hostname) ? hostname : undefined;
  } catch {
    return undefined;
  }
}
