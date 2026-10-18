import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Barlow, Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { TermsGate } from "@/components/legal/terms-gate";
import { getClientMessages } from "@/i18n/client-messages";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";

import "../globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });
const barlow = Barlow({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#0a0d12",
  colorScheme: "dark",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await rootLocale();
  const t = await getTranslations("Metadata");
  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: t("defaultTitle"), template: t("titleTemplate") },
    description: t("description"),
    applicationName: siteConfig.name,
    openGraph: {
      siteName: siteConfig.name,
      type: "website",
      locale: locale === "de" ? "de_DE" : "en_US",
    },
  };
}

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) notFound();

  // Nur Texte an den Browser senden, die Client-Komponenten tatsächlich benötigen.
  const clientMessages = await getClientMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${barlow.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider messages={clientMessages}>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          {/* Popup bei neuer Fassung der Nutzungsbedingungen (liest die Session, daher hinter Suspense) */}
          <Suspense fallback={null}>
            <TermsGate />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
