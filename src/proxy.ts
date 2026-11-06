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

/**
 * Ziel der 404-Umschreibung, bewusst mit `http://`.
 *
 * Mit `next start -H 127.0.0.1` (systemd-Dienst) kann Next eine Umschreibung
 * aus dem Proxy nie als intern erkennen: NextURL macht aus jeder
 * Loopback-Adresse `localhost`, der Router vergleicht aber mit `127.0.0.1`.
 * Next leitet die Anfrage dann an sich selbst weiter (ein zweiter Durchlauf
 * durch diesen Proxy). Hinter Caddy steht das Protokoll wegen
 * X-Forwarded-Proto auf https, und die Weiterleitung an den HTTP-Server
 * scheiterte mit einem 500. Mit `http://` gelingt sie; nur 404-Antworten
 * nehmen diesen Umweg. Geprüft vom E2E-Test „hinter einem Reverse Proxy“.
 */
function notFoundUrl(request: NextRequest, locale: string): URL {
  return new URL(`/${locale}/not-found`, `http://${request.nextUrl.host}`);
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
    return NextResponse.rewrite(notFoundUrl(request, detail.locale), { status: 404 });
  }

  return intlMiddleware(request);
}

export const config = {
  // Alles außer API, Weiterleitungen (/go), Next-Interna, Metadaten-Routen und Dateien mit Endung
  matcher: ["/((?!api/|go/|_next|_vercel|sitemap\\.xml|robots\\.txt|.*\\..*).*)"],
};
