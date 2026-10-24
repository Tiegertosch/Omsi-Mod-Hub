@AGENTS.md

# CLAUDE.md – OMSI Mod Hub

Katalog- und Downloadportal für Mods des Busimulators OMSI 2. Das Portal hostet **keine** Mod-Archive, Downloads verweisen immer auf externe, gekennzeichnete Seiten. Status: geschlossene Beta auf einem eigenen Linux-Server, Repo öffentlich (AGPL-3.0).

Ausführliche Begründungen stehen in den Docs, nicht hier:

| Datei | Inhalt |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Entscheidungen und Begründungen (Caching, Auth, 404, Suche, Uploads, Sicherheit) |
| [docs/PROJEKTSTAND.md](docs/PROJEKTSTAND.md) | Fallstricke und offene Punkte |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Server-Einrichtung und Betrieb (Ubuntu, systemd, Caddy) |
| [README.md](README.md) | Funktionsumfang, Umgebungsvariablen, Befehle, bekannte Einschränkungen |
| `docs/intern/` | Serverdetails, lokal und per `.gitignore` ausgeschlossen. Inhalte daraus nie in versionierte Dateien übernehmen. |

## Stack

Next.js 16.4 (App Router, Cache Components, Turbopack) · React 19.3 · TypeScript strict · Tailwind 4 · Prisma 7.10 + PostgreSQL 18 (`@prisma/adapter-pg`) · Better Auth 1.7 · next-intl 4 · Zod 4 · Vitest 5 · Playwright · pnpm 12 · Node 24 LTS.

Lokal wird unter **Windows** entwickelt (PowerShell, deutsches Gebietsschema), produktiv läuft das Projekt auf **Ubuntu 24.04**.

## Befehle

```bash
pnpm dev                 # Entwicklungsserver, Port 3000
pnpm check               # typecheck + lint + Unit-Tests – vor jedem Commit
pnpm build               # braucht eine erreichbare Datenbank (rendert Seiten mit Daten vor)
pnpm test:e2e            # Playwright gegen den letzten Build (pnpm start), nicht gegen dev
pnpm db:migrate          # Migration erzeugen und anwenden (Entwicklung)
pnpm db:seed             # Stammdaten + gekennzeichnete Beispieldaten
pnpm user:set-role <email> <user|creator|admin>
```

Nach Codeänderungen erst `pnpm build`, dann `pnpm test:e2e`. Sonst testen die E2E-Tests den alten Build.

## Architekturregeln

- **Lesen** nur in Server Components über `src/server/data/*`. Öffentliche Abfragen filtern immer auf `status = PUBLISHED`.
- **Schreiben** nur über Server Actions in `src/server/actions/*`: Zod-Validierung, Rate-Limit (`consumeRateLimit` aus `src/server/rate-limit.ts`), Anmelde- und Rechteprüfung in der Action selbst. Ausgeblendete UI ist kein Schutz.
- **Autorisierung** über `src/server/session.ts`:
  - Actions, die Inhalte, Profile oder Moderation ändern, nutzen `getActingUser()`. Es liefert `terms_required`, wenn der Nutzer der aktuellen Fassung der Nutzungsbedingungen nicht zugestimmt hat.
  - Kontosicherheit, Abmelden und Konto löschen nutzen `getCurrentUser()`.
  - Admin: `requireAdmin` (Seite), `assertAdmin` (Datenfunktion), `adminActor()` (Action). Alle drei Prüfungen sind Pflicht.
  - Creator-Abfragen filtern auf `creatorId = aktueller Nutzer`.
- **Session-Zugriffe** stehen immer hinter `<Suspense>`, nie im Layout (Cache Components).
- **Direkte `auth.api.*`-Aufrufe** umgehen das Rate-Limit und die Origin-Prüfung von Better Auth. Jede Auth-Action braucht deshalb ein eigenes Limit pro IP **und** pro Konto bzw. E-Mail. Die Endpunkte in `disabledPaths` (`src/lib/auth.ts`) bleiben über HTTP gesperrt.
- **Caching** (`src/server/public-cache.ts`): Nach jeder Schreibaktion `projectsChanged` / `creatorChanged` / `taxonomyChanged` aufrufen. Listen nutzen stale-while-revalidate (`revalidateTag(…, "max")`), Detailseiten `updateTag`. Keinen einzelnen globalen Tag einführen; das hat gemessen alle Prefetches blockiert.
- **Suchspalte:** Bei jeder Änderung von Texten oder Tags `rebuildSearchText` in derselben Transaktion aufrufen.
- **`/mods/[slug]`** teilen sich Kategorien und Projekte, Kategorien haben Vorrang. Slugs werden in beide Richtungen auf Kollision geprüft.
- **Echte 404** prüft der Proxy (`src/proxy.ts` → `src/server/route-existence.ts`). Neue öffentliche Detailrouten dort eintragen.
- **Reine Logik** gehört nach `src/lib` (ohne Framework-Abhängigkeit) und bekommt Unit-Tests in `tests/unit`.
- **Migrationen nur additiv** (neue Spalten oder Tabellen): `deploy.sh` stellt bei Fehlern den Code zurück, aber nie die Datenbank. Im Schema keine providerspezifischen `@db.*`-Typen.
- **PostgreSQL:** `contains` unterscheidet Groß- und Kleinschreibung. Benutzername, E-Mail und Suchtext liegen kleingeschrieben vor, für frei geschriebene Namen gilt `mode: "insensitive"`.

## Sicherheit (nicht verhandelbar)

- Nutzertext immer als Text rendern: kein `dangerouslySetInnerHTML`, kein Markdown. Formatierung läuft über den eigenen Parser `src/lib/rich-text.ts`.
- Externe URLs nur über `parseExternalUrl()`, Weiterleitungen nach dem Login nur über `safeRedirectPath()`, Downloads nur über `/go/[linkId]`.
- Rohes SQL nur als parametrisierte Tagged Templates.
- Uploads: Signaturprüfung, Neukodierung zu WebP und Auslieferung über `/media/[key]` (`src/server/images.ts`, `storage.ts`).
- Keine personenbezogenen Daten in Logs. IP-Adressen nur gehasht speichern.
- Keine Fremdskripte. Die CSP (`next.config.ts`) erlaubt nur die eigene Herkunft; `tests/e2e/csp.spec.ts` prüft das.
- Kein Ausspähen registrierter Adressen: Antworten und Antwortzeiten bei Registrierung, Reset und E-Mail-Änderung bleiben gleich, egal ob die Adresse vergeben ist.

## Konventionen

- **Sprache:** Code-Kommentare, Docs und Commit-Messages auf Deutsch. Commit-Betreff kurz, ohne Präfix, beschreibt das Ergebnis (z. B. „Projekte als Freeware oder Payware kennzeichnen“).
- **UI-Texte** stehen in `messages/de.json` **und** `messages/en.json`, immer beide pflegen. An den Client gehen nur die Namespaces `Report` und `Errors`.
- **Routen** haben immer ein Sprachpräfix (`/de/…`, `/en/…`). Fallback-Sprache für Gäste ist Englisch. Die Sprache wird über `next/root-params` gelesen.
- **Docs mitpflegen:** Neue Funktionen oder Einschränkungen in `README.md` **und** `README.en.md` eintragen, Entscheidungen in `docs/ARCHITECTURE.md`, offene Punkte in `docs/PROJEKTSTAND.md`.
- **UI:** eigene kleine Komponenten in `src/components/ui` (kein shadcn), Design-Tokens in `src/app/globals.css`, nur Dark Mode. Filter und Sortierung als Links oder GET-Formulare, Formulare funktionieren ohne JavaScript.
- **Rechtstexte** liegen in `content/legal/`. Eine neue Fassung der Nutzungsbedingungen wird in `TERMS_VERSIONS` (`src/lib/legal.ts`) eingetragen; den Ablauf beschreibt der Kommentar dort. Rechtstexte inhaltlich nur auf ausdrücklichen Wunsch ändern.

## Tests

- Unit-Tests: `tests/unit/**/*.test.ts` (Vitest, Node-Umgebung).
- E2E-Tests: `tests/e2e/*.spec.ts`, Hilfsfunktionen in `helpers.ts` (`uniqueUser`, `waitForMail`, `randomIp`). Testkonten laufen unter `@e2e.example.com`, Test-Kategorien und -Tags mit Präfix `e2e-`. Der Teardown räumt beides auf.
- **Sauber testen:**
  - Der E2E-Server schreibt Mails nach `.e2e-mail`. `.dev-mail` ist das persönliche Test-Postfach des Nutzers und bleibt unberührt. Jeder selbst gestartete Server (Screenshots o. ä.) braucht `DEV_MAIL_DIR=.e2e-mail`.
  - Vor dem Lauf prüfen, ob Port 3000 frei ist (kein `reuseExistingServer`). Unter deutschem Windows: `netstat -ano | grep -E ":3000 " | grep -E "LISTENING|ABH"`.
  - Einen Lauf bewusst starten, nicht in Schleifen wiederholen. Bei vielen Timeouts zuerst die Umgebung untersuchen.
  - Danach prüfen, dass kein Server übrig ist (`taskkill //PID <pid> //T //F`) und die Mail-Ordner sauber sind.
- Mit Cache Components bleiben vorherige Routen per `<Activity>` versteckt im DOM erhalten. Locators deshalb eindeutig wählen.
- Im Dev-Modus taucht gelegentlich der Fehler „cookies object that does not match“ auf (Next-Bug). E2E-Tests deshalb nur gegen den Produktionsbuild.

## Abhängigkeiten

- `next`, `react`, `react-dom`, `better-auth`, `prisma`/`@prisma/*`, `zod`, `next-intl` und `sharp` sind **exakt** angeheftet. Updates nur gezielt und danach `check`, `build` und `test:e2e` laufen lassen.
- `minimumReleaseAge` ist aktiv. Sehr frische Versionen brauchen eine Ausnahme in `pnpm-workspace.yaml`. Build-Skripte nur über `allowBuilds` freigeben.
- Prisma bleibt auf 7.x, obwohl npm `latest` auf einen 8.0-RC zeigt. TypeScript 7, ESLint 10 und `@types/node` > 24 sind noch nicht freigegeben (Kompatibilität mit Next und Node 24 offen).

## Deployment

`deploy/deploy.sh` läuft auf dem Server als Nutzer `omsi`. Es klont `main`, installiert, wendet Migrationen an, baut, schaltet um und startet den Dienst neu. Schlägt der Health-Check fehl, stellt es automatisch zurück. Was auf `main` gepusht ist, wird also beim nächsten Deployment live. Server nur auf ausdrückliche Anweisung anfassen; Befehle stehen in `docs/DEPLOYMENT.md`. Auf dem Server nie `pnpm db:seed` ohne `SEED_SAMPLES=false`.
