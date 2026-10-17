import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { publicRouteExists, type PublicDetailRoute } from "./server/route-existence";

const intlMiddleware = createMiddleware(routing);
const LOCALES = routing.locales.join("|");
const PROTECTED = new RegExp(`^/(${LOCALES})/(dashboard|admin)(?:/|$)`);
const PUBLIC_DETAIL = new RegExp(`^/(${LOCALES})/(mods|creators|legal)/([^/]+)/?$`);

function detailRoute(pathname: string): { locale: string; route: PublicDetailRoute } | null {
  const match = PUBLIC_DETAIL.exec(pathname);
  if (!match) return null;
  let key: string;
  try {
    key = decodeURIComponent(match[3]);
  } catch {
    key = "";
  }
  return { locale: match[1], route: { kind: match[2] as PublicDetailRoute["kind"], key } };
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Schnelle Vorprüfung: ohne Session-Cookie direkt zum Login. Die eigentliche
  // Prüfung (gültige Session, Rolle) erfolgt serverseitig in jeder Seite und Action.
  const match = PROTECTED.exec(pathname);
  if (match && !getSessionCookie(request)) {
    const login = new URL(`/${match[1]}/login`, request.url);
    login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  // Unbekannte Projekte, Kategorien, Creator und Rechtsseiten: echter 404 statt
  // gestreamter 404-Seite mit Status 200. Die Umschreibung landet in der
  // Catch-all-Route und zeigt dort die lokalisierte 404-Seite.
  const detail = detailRoute(pathname);
  if (detail && !(await publicRouteExists(detail.route))) {
    return NextResponse.rewrite(new URL(`/${detail.locale}/not-found`, request.url), { status: 404 });
  }

  return intlMiddleware(request);
}

export const config = {
  // Alles außer API, Weiterleitungen (/go), Next-Interna, Metadaten-Routen und Dateien mit Endung
  matcher: ["/((?!api/|go/|_next|_vercel|sitemap\\.xml|robots\\.txt|.*\\..*).*)"],
};
