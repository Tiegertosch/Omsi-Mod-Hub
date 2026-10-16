import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);
const PROTECTED = new RegExp(`^/(${routing.locales.join("|")})/(dashboard|admin)(?:/|$)`);

export default function proxy(request: NextRequest) {
  // Schnelle Vorprüfung: ohne Session-Cookie direkt zum Login. Die eigentliche
  // Prüfung (gültige Session, Rolle) erfolgt serverseitig in jeder Seite und Action.
  const match = PROTECTED.exec(request.nextUrl.pathname);
  if (match && !getSessionCookie(request)) {
    const login = new URL(`/${match[1]}/login`, request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return intlMiddleware(request);
}

export const config = {
  // Alles außer API, Weiterleitungen (/go), Next-Interna, Metadaten-Routen und Dateien mit Endung
  matcher: ["/((?!api/|go/|_next|_vercel|sitemap\\.xml|robots\\.txt|.*\\..*).*)"],
};
