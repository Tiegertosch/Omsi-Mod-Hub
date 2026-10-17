# OMSI Mod Hub

Internationales Katalog- und Downloadportal für Mods des Omnibus-Simulators **OMSI 2** (Arbeitstitel).

Spieler finden Mods, sehen Voraussetzungen, Versionen und Kompatibilität und gelangen zur Originalquelle des Erstellers. Das Portal **hostet selbst keine Mod-Archive** – Downloads verweisen immer auf externe Seiten, die klar als solche gekennzeichnet sind.

> **Status:** Öffentlicher Bereich, Benutzerkonten, Creator-Dashboard und Adminbereich (Freigaben, Ausblenden, Meldungen, Sperren, Kategorien/Tags, Protokoll) sind umgesetzt – siehe [Nächste Schritte](#nächste-schritte).

## Funktionsumfang (aktueller Stand)

| Bereich | Stand |
| --- | --- |
| Startseite mit Kategorien, neuen, aktualisierten und beliebten Projekten, Creatorn | ✅ aus der Datenbank |
| Mod-Katalog `/mods` und Kategorien `/mods/busse`, `/mods/karten`, … | ✅ |
| Serverseitige Suche, Tag-Filter (UND), Sortierung, Pagination, teilbare URLs | ✅ |
| Projekt-Detailseite mit Versionen, Changelog, Installation, Voraussetzungen, Lizenz, Mitwirkenden | ✅ |
| Externe Downloadlinks mit Kennzeichnung, Zählung der Aufrufe über `/go/[id]` | ✅ |
| Meldefunktion (Server Action, Rate-Limit, Honeypot) | ✅ Bearbeitung unter `/admin/reports` |
| Creator-Verzeichnis und -Profile | ✅ |
| Deutsch/Englisch: sprachabhängige Routen, Metadaten, Fallback für Projekttexte | ✅ |
| SEO: Titel, Beschreibungen, Canonical, hreflang, Open Graph, Sitemap, robots.txt | ✅ |
| Zwischenspeicherung öffentlicher Daten (`use cache` mit Tags), echte HTTP-404 für unbekannte Projekte, Kategorien, Creator und Seiten | ✅ |
| Registrierung mit E-Mail-Bestätigung, Anmeldung (E-Mail oder Benutzername), Abmeldung | ✅ Better Auth |
| Passwort vergessen / zurücksetzen per E-Mail-Link | ✅ |
| Dashboard und Einstellungen (Anzeigename, bevorzugte Sprache, Passwort ändern) | ✅ |
| Rollen `user` / `creator` / `admin`, serverseitig geprüft; Adminübersicht (Kennzahlen, Meldungen, neue Konten) | ✅ |
| Creator werden (Creator-Profil), Projektliste, Editor: Texte DE/EN, Kategorie, Tags, Lizenz, Mitwirkende | ✅ |
| Titelbild und Screenshots: sicherer Upload (Signaturprüfung, ≤ 5 MB, Neukodierung zu WebP ohne Metadaten) | ✅ |
| Versionen mit Changelog und mehreren externen Downloadlinks | ✅ |
| Status: Entwurf → Einreichen → Freigabe/Zurückweisung (mit Begründung), Zurückziehen, Archivieren; Vorschau | ✅ |
| Admin: Freigabe-Warteschlange und Ausblenden/Wiedereinblenden veröffentlichter Projekte (mit Begründung) `/admin/projects` | ✅ |
| Admin: Meldungen bearbeiten (offen → in Bearbeitung → erledigt/verworfen, interne Notiz) `/admin/reports` | ✅ |
| Admin: Konten suchen und befristet/unbefristet sperren (beendet Sitzungen, optional Projekte ausblenden) `/admin/users` | ✅ |
| Admin: Kategorien und Tags anlegen, bearbeiten, löschen `/admin/categories`, `/admin/tags`; Protokoll `/admin/audit` | ✅ |
| E-Mail an Creator bei Freigabe, Zurückweisung, Ausblenden und Wiedereinblenden | ✅ |
| Rechtliche Seiten | ⚠️ nur als gekennzeichnete, ungeprüfte Vorlagen |

## Technologie

- **Next.js 16.4** (App Router, Cache Components, Turbopack), **React 19.3**, **TypeScript** (strict)
- **Tailwind CSS 4** mit eigenen Design-Tokens, Icons von **lucide-react**
- **Prisma 7.10** mit **SQLite** (lokal) – vorbereitet für **PostgreSQL**
- **Better Auth 1.7** (E-Mail/Passwort, Plugins `username` und `admin`), **nodemailer** für E-Mails
- **next-intl 4** für Internationalisierung
- **Zod 4** für Validierung
- **Vitest 5** (Unit) und **Playwright 1.64** (End-to-End)
- Paketmanager **pnpm 12**

Begründungen und Architekturentscheidungen: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Voraussetzungen

- Node.js **≥ 20.19** (getestet mit 24.22)
- pnpm **12** (`npm install -g pnpm`)

## Installation

```bash
pnpm install          # installiert Abhängigkeiten und erzeugt den Prisma-Client
cp .env.example .env  # Windows PowerShell: Copy-Item .env.example .env
                      # → BETTER_AUTH_SECRET setzen (siehe unten)
pnpm db:migrate       # legt die SQLite-Datenbank an und wendet Migrationen an
pnpm db:seed          # Kategorien, Tags und gekennzeichnete Beispieldaten
pnpm dev              # http://localhost:3000
```

pnpm 12 führt Build-Skripte von Abhängigkeiten nur nach Freigabe aus. Die benötigten Freigaben (`better-sqlite3`, `prisma`, `@prisma/engines`, `esbuild`) stehen bereits in `pnpm-workspace.yaml`.

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
| --- | --- | --- |
| `DATABASE_URL` | ja | Lokal `file:./prisma/dev.db` (relativ zum Projektverzeichnis). |
| `NEXT_PUBLIC_SITE_URL` | empfohlen | Öffentliche Basis-URL ohne abschließenden Slash; wird für Canonical-URLs, Sitemap und Open Graph verwendet. Standard: `http://localhost:3000`. |
| `BETTER_AUTH_SECRET` | ja | Zufälliges Secret (≥ 32 Zeichen) zum Signieren von Sessions und Tokens. Erzeugen: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `BETTER_AUTH_URL` | ja | Öffentliche URL der App. Links in E-Mails zeigen dorthin; muss zur aufgerufenen Adresse passen. |
| `MAIL_TRANSPORT` | ja in Produktion | `file` (Entwicklung: Mails als JSON in `./.dev-mail`), `console` (Entwicklung) oder `smtp`. Ohne Angabe gilt lokal `file`; in Produktion schlägt der Versand dann fehl. |
| `SMTP_URL`, `MAIL_FROM` | bei `smtp` | z. B. `smtps://user:pass@smtp.example.com:465` und `OMSI Mod Hub <no-reply@example.com>` |
| `PROJECT_REVIEW_REQUIRED` | nein | `true` (Standard): Einreichungen brauchen eine Admin-Freigabe. `false`: Einreichen veröffentlicht direkt. |
| `UPLOAD_DIR` | nein | Ablage hochgeladener Bilder, Standard `./storage/uploads` (nicht in `public/`, Auslieferung über `/media/…`). |

Vorlage: [.env.example](.env.example). Echte Zugangsdaten gehören nie ins Repository.

## Konten und Rollen

- **Registrierung** erfordert eine bestätigte E-Mail-Adresse, bevor eine Anmeldung möglich ist. Lokal liegt der Bestätigungslink in der neuesten Datei unter `.dev-mail/`.
- **Rollen:** `user` (Standard), `creator`, `admin`. Rollen lassen sich weder bei der Registrierung noch über die API ändern – nur serverseitig.
- **Erstes Admin-Konto:** Konto normal registrieren und bestätigen, dann lokal auf dem Server ausführen:
  ```bash
  pnpm user:set-role deine@adresse.example admin
  ```
  Die Änderung wird im Audit-Log protokolliert. Es gibt bewusst keine Web-Route und keinen Seed dafür.
- **Creator:** Jedes bestätigte Konto kann unter *Dashboard → Meine Projekte* selbst ein Creator-Profil anlegen und erhält damit die Rolle `creator` (protokolliert). Projekte durchlaufen: Entwurf → *Zur Prüfung einreichen* (Checkliste: Texte in der Originalsprache, Kategorie, Lizenz, mindestens eine Version mit Link) → Freigabe oder Zurückweisung mit Begründung unter `/admin/projects`. Veröffentlichte Projekte bleiben bearbeitbar; Änderungen sind sofort öffentlich. Das URL-Kürzel ist nach der ersten Veröffentlichung fest.
- **Geschützte Bereiche:** `/dashboard` (angemeldet) und `/admin` (Rolle `admin`; andere erhalten eine 404). Die Prüfung erfolgt serverseitig in jeder Seite und jeder Server Action; der Proxy leitet ohne Session-Cookie nur vorab zum Login.

## Datenbank

| Befehl | Zweck |
| --- | --- |
| `pnpm db:migrate` | Migration aus Schemaänderungen erzeugen und anwenden (Entwicklung) |
| `pnpm db:deploy` | Vorhandene Migrationen anwenden (Produktion/CI) |
| `pnpm db:seed` | Kategorien und Tags anlegen bzw. aktualisieren; Beispieldaten neu erzeugen |
| `SEED_SAMPLES=false pnpm db:seed` | Nur Stammdaten, keine Beispieldaten |
| `pnpm db:clear-samples` | Alle Beispieldaten (`isSample = true`) entfernen |
| `pnpm db:reset` | Datenbank zurücksetzen, alle Migrationen und den Seed neu ausführen (**löscht alle Daten**) |
| `pnpm db:studio` | Prisma Studio öffnen |
| `pnpm user:set-role <email> <user\|creator\|admin>` | Rolle eines bestätigten Kontos setzen (lokales CLI, mit Audit-Log) |

**Beispieldaten:** Alle Creator und Projekte aus dem Seed sind fiktiv, mit `isSample = true` markiert, in der Oberfläche als „Beispieldaten“ gekennzeichnet, per `noindex` von Suchmaschinen ausgeschlossen und verlinken nur auf `example.com`. Die Illustrationen unter `public/samples/` wurden eigens erstellt. Der Seed legt **keine Admin-Konten und keine Passwörter** an.

**Backups (SQLite):** Server stoppen und `prisma/dev.db` kopieren. Für PostgreSQL ist `pg_dump` vorgesehen.

### Umstieg auf PostgreSQL

1. `provider = "postgresql"` in `prisma/schema.prisma` setzen.
2. `pnpm add @prisma/adapter-pg` und in `src/lib/db.ts` sowie `prisma/seed.ts` `PrismaBetterSqlite3` durch `PrismaPg` ersetzen.
3. `DATABASE_URL` auf die PostgreSQL-Instanz setzen.
4. Den Ordner `prisma/migrations` durch eine neu erzeugte Initial-Migration ersetzen (`pnpm db:migrate --name init`), da Migrationen providerspezifisch sind.

Mit PostgreSQL wurde der Code bisher **nicht getestet**, da lokal kein Server verfügbar war.

## Entwicklung, Tests und Build

| Befehl | Zweck |
| --- | --- |
| `pnpm dev` | Entwicklungsserver |
| `pnpm typecheck` | Routen-Typen erzeugen und TypeScript prüfen |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit-Tests (Vitest) |
| `pnpm check` | typecheck + lint + test |
| `pnpm build` / `pnpm start` | Produktionsbuild / -server |
| `pnpm test:e2e` | Playwright-Tests gegen den Produktionsbuild (vorher `pnpm build`, DB geseedet) |

Für die E2E-Tests einmalig den Browser installieren: `pnpm exec playwright install chromium`. Die Tests laufen auf Port 3000 (muss zu `BETTER_AUTH_URL` passen) und lesen Bestätigungs- und Reset-Links aus `.dev-mail/`. Angelegte Testkonten (`@e2e.example.com`) samt Projekten, Meldungen, Protokolleinträgen und Test-Mails sowie Test-Kategorien/-Tags (`e2e-…`) werden danach automatisch entfernt; der Meldungstest auf der öffentlichen Seite legt einen Report an einem Beispielprojekt an, `pnpm db:seed` setzt die Beispieldaten zurück.

## Projektstruktur

```
messages/              UI-Texte (de.json, en.json)
prisma/                Schema, Migrationen, Seed
public/samples/        eigene Illustrationen für Beispieldaten
src/
  app/
    [locale]/          lokalisierte Seiten (Start, mods, creators, search, legal,
                       login, register, forgot-/reset-password, verify-email, dashboard, admin)
    api/auth/[...all]/ Better-Auth-Endpunkte
    go/[linkId]/       Weiterleitung zu externen Downloads (zählt Aufrufe)
    sitemap.ts, robots.ts, icon.svg
  components/
    layout/            Header, Footer, Navigation, Sprachumschaltung, Suche
    mods/              Projektkarten, Katalog, Detailansicht, Downloadlinks, Meldeformular
    creators/          Creator-Karten
    auth/, account/    Anmeldeformulare, Konto-Menü, Einstellungsformulare
    editor/, creator/  Projekteditor (Daten, Medien, Versionen, Status), Creator-Profil
    admin/             Navigation, Moderation, Meldungen, Sperren, Kategorie-/Tag-Formulare
    ui/                Basiskomponenten (Button, Badge, Formularfelder, Leer-/Lade-/Hinweiszustände)
  i18n/                next-intl: Routing, Navigation, Request-Konfiguration
  lib/                 auth.ts (Better-Auth-Konfiguration) und reine Hilfsfunktionen
  server/
    session.ts         Data Access Layer: aktueller Nutzer, requireUser/requireAdmin
    data/              Datenbankabfragen (nur serverseitig)
    actions/           Server Actions (Anmeldung, Konto, Projekte, Moderation, Meldungen, Konten, Kategorien/Tags)
    admin-action.ts    gemeinsame Prüfung für Admin-Actions (Rolle, Rate-Limit)
    emails.ts          lokalisierte E-Mail-Texte (Bestätigung, Passwort, Moderationsentscheidungen)
    mail.ts            E-Mail-Versand (file/console/smtp)
    images.ts, storage.ts  Bildprüfung/-neukodierung (sharp) und Ablage
  app/media/[key]/     Auslieferung hochgeladener Bilder
  proxy.ts             Spracherkennung, Vorab-Weiterleitung geschützter Bereiche
scripts/               set-role.ts (Rollen per CLI), cleanup-e2e.ts
tests/
  unit/                Vitest
  e2e/                 Playwright
```

## Bekannte Einschränkungen

- **Moderation:** Admin-Rechte werden bewusst nur per CLI vergeben und entzogen; Admins können nicht gesperrt werden. Eine Sperre blendet Projekte nur auf Wunsch aus, und das Aufheben der Sperre blendet sie nicht automatisch wieder ein. Kategorien sind einstufig verwaltbar (keine Oberkategorie wählbar); Kürzel von Kategorien und Tags sind nach dem Anlegen fest. Gesperrte Nutzer sehen beim Login nur „Konto gesperrt“, nicht den Grund. Das Protokoll zeigt die letzten 100 Einträge ohne Filter.
- **Benachrichtigungen** werden ohne Warteschlange im Hintergrund versendet; schlägt der Versand fehl, wird das nur protokolliert (kein erneuter Versuch). An Beispielkonten wird nichts gesendet.
- **Bildspeicher lokal:** Uploads liegen im Dateisystem (`UPLOAD_DIR`). Für mehrere Server-Instanzen oder Serverless-Hosting ist ein Objektspeicher (z. B. S3) nötig; die Schnittstelle ist in `src/server/storage.ts` gekapselt. Backups müssen dieses Verzeichnis einschließen.
- **Reihenfolge von Screenshots** lässt sich noch nicht ändern (Upload-Reihenfolge); Bildbeschreibungen nur beim Hochladen.
- **SMTP-Versand nicht getestet:** Getestet ist der Ablauf mit `MAIL_TRANSPORT=file`. Der SMTP-Transport ist implementiert, mangels Zugangsdaten aber nicht gegen einen echten Server geprüft.
- **IP-basierte Rate-Limits** lesen `X-Forwarded-For`. Das ist nur hinter einem Reverse Proxy belastbar, der diesen Header setzt bzw. überschreibt; direkt im Internet ließe sich das IP-Limit umgehen. Limits pro Konto/E-Mail bleiben wirksam.
- **Benutzernamen** sind nach der Registrierung unveränderlich (Teil der Profil-URL). Konto löschen und E-Mail ändern sind noch nicht umgesetzt.
- **Zwischenspeicherung:** Öffentliche Daten sind gecacht (Details in ARCHITECTURE.md). Listen und Katalog zeigen nach einer Änderung für eine Anfrage noch den alten Stand; Aufrufzähler sind bis zu einige Minuten alt. Änderungen direkt in der Datenbank (Seed, Prisma Studio, CLI) erscheinen erst nach Ablauf der Cache-Dauer oder nach einem Neustart. Der Cache liegt im Arbeitsspeicher – für mehrere Server-Instanzen ist ein gemeinsamer Cache-Handler nötig. `pnpm build` braucht Zugriff auf die Datenbank.
- **404-Prüfung im Proxy:** Für Projekt-, Kategorie-, Creator- und Rechtsseiten fragt der Proxy pro Aufruf (auch für Prefetches) die Datenbank über eindeutige Indizes ab. Bei sehr viel Verkehr wäre ein kurzer Zwischenspeicher dafür sinnvoll.
- **Suche:** Teilstring-Suche über eine normalisierte Suchspalte – ausreichend für das MVP, aber ohne Relevanz-Ranking und bei vielen Tausend Projekten langsam. Geplant: PostgreSQL-Volltextsuche bzw. `pg_trgm`.
- **Linkaufrufe** werden ohne Bot-Erkennung über die User-Agent-Heuristik hinaus gezählt und sind daher eine Näherung.
- **Nur Dark Mode**; ein helles Theme ist nicht geplant, solange es keinen Bedarf gibt.
- **Rechtstexte** sind ungeprüfte Vorlagen mit Platzhaltern und dürfen so nicht live gehen.
- Content-Security-Policy ist noch nicht gesetzt (andere Sicherheits-Header schon).

## Nächste Schritte

1. **Moderation ausbauen:** Projekte einer anderen Kategorie zuordnen, Protokoll filtern/paginieren, Linkstatus (`BROKEN`/`BLOCKED`) aus Meldungen heraus setzen.
2. **Benachrichtigungen:** Versand-Warteschlange mit Wiederholung, Abmeldeoption für Benachrichtigungen.
3. **Konto:** E-Mail ändern, Konto löschen, aktive Sitzungen anzeigen.
4. **Objektspeicher** für Uploads (S3-kompatibel) statt lokalem Dateisystem.
5. **Linkprüfung** im Hintergrund mit DNS-basiertem SSRF-Schutz.
6. **PostgreSQL** für Staging/Produktion, Volltextsuche, Backups; gemeinsamer Cache-Handler bei mehreren Instanzen.
