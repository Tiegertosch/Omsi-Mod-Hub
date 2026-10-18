# Projektstand OMSI Mod Hub

Stand: **17.10.2026**, `main` inklusive Konto-Funktionen (E-Mail ändern, Geräte, Konto löschen). Diese Datei fasst zusammen, was gebaut wurde, warum Entscheidungen so gefallen sind, wie die Beta betrieben wird und was offen ist. Details stehen in [README.md](../README.md), [ARCHITECTURE.md](ARCHITECTURE.md) und [DEPLOYMENT.md](DEPLOYMENT.md).

## Kurzfassung

- Zweisprachiges (DE/EN) Katalogportal für OMSI-2-Mods. **Es werden keine Mod-Dateien gehostet**, nur externe Links. Zielgruppe ist international, die Standardsprache Englisch.
- Fertig sind: öffentlicher Katalog, Konten (inklusive E-Mail ändern, Geräteübersicht, Konto löschen), Creator-Dashboard, Adminbereich, Caching mit echten 404-Statuscodes, Deployment, Datenbank PostgreSQL.
- **Geschlossene Beta live** unter `https://beta.omsi-modhub.de`, hinter Basic Auth, nicht indexiert. Die Datenbank wurde dort am 17.10.2026 mit PostgreSQL neu gestartet.
- Tests: 115 Unit-Tests (Vitest) und 50 E2E-Tests (Playwright) sind grün, lokal gegen PostgreSQL 18.

## Arbeitsweise mit dem Nutzer

- Kommunikation auf Deutsch. Der Nutzer erwartet echte, funktionierende Features ohne Mock-Oberflächen und ehrliche Testberichte.
- Systemsoftware installiert der Nutzer selbst (Node.js, PostgreSQL); vorher fragen.
- **Git:**
  - Neue Arbeit auf einem Feature-Branch, danach Fast-Forward nach `main`, pushen und den Branch löschen, jeweils nach Zustimmung.
  - Reine Doku-Korrekturen gehen direkt auf `main`.
  - Repo: `github.com/Tiegertosch/Omsi-Mod-Hub` (privat).
- Commits enden mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Keine Secrets ins Repo. `.env` ist lokal und gitignored.

## Technik

| Bereich | Wahl |
|---|---|
| Framework | Next.js **16.4.2** (App Router, Turbopack, `cacheComponents` + `partialPrefetching`, `proxy.ts` statt Middleware), React 19.3, TypeScript strict |
| Datenbank | **PostgreSQL 18** über Prisma **7.10.1** mit `@prisma/adapter-pg`; Client-Erzeugung in `src/lib/prisma-factory.ts`. Konfiguration in `prisma7.config.ts`, Seed `prisma/seed.ts` |
| Auth | **Better Auth 1.7.10**: Plugins `username` (unveränderlich), `admin` mit eigener Rolle `creator` und `emailOTP` (nur Bestätigungscode), E-Mail-Bestätigung Pflicht, Rate-Limit in der Datenbank |
| i18n | next-intl 4.14.9, Routen mit Präfix `/de` und `/en`, `next/root-params` |
| Sonstiges | Tailwind 4, Zod 4, nodemailer (Transport `file`/`console`/`smtp`), sharp (Bild-Upload mit Neukodierung zu WebP), pnpm 12.11.2 |

## Funktionen

- **Öffentlich:**
  - Katalog `/mods`, Kategorien `/mods/[slug]` (Kategorien haben Vorrang vor Projekt-Slugs), Projektdetail
  - Creator-Verzeichnis und -Profile, Suche über die normalisierte Spalte `searchText`, Tag-Filter, Sortierung
  - Meldeformular
  - Download-Links über `/go/[linkId]` mit Klickzähler (Raw SQL, verändert `updatedAt` nicht)
  - Projektseite: Titelbild und Screenshots in einem Karussell (`src/components/mods/media-carousel.tsx`, CSS-Scroll-Snapping, ohne Bibliothek); Karten zeigen nur das Titelbild
  - Rechtsseiten: Impressum mit den echten Angaben (Adresse über online-impressum.de, `kontakt@omsi-modhub.de`); Datenschutzerklärung aus dem WBS-Generator als Datei `content/legal/privacy.de.md` (eigener kleiner Markdown-Parser `src/lib/legal-markdown.ts`, englische Seite mit Hinweis „nur Deutsch“); Nutzungsbedingungen als `content/legal/terms.de.md`/`terms.en.md` (Regeln: Konto ab 16, fremde Projekte nur mit Erlaubnis, Payware gekennzeichnet, Haftung und Rechtswahl nach Vorgabe des Betreibers), noch als **Entwurf** gekennzeichnet bis zur Rechtsprüfung. SEO, Sitemap, Dark Mode
- **Konten:** Registrierung in zwei Schritten mit Fortschrittsanzeige: Kontodaten, dann 6-stelliger Code (Seite `/confirm-email`, eine Box pro Ziffer, Code erneut senden, Adresse über Schritt 1 korrigieren), Login per E-Mail oder Benutzername, Passwort vergessen, Einstellungen. Dazu E-Mail ändern (Link an alte, dann an neue Adresse), angemeldete Geräte anzeigen und abmelden, Konto löschen (mit allen Projekten und Bildern; Admins ausgenommen).
- **Creator-Dashboard:**
  - Creator-Profil anlegen, Projekt-Editor zweisprachig
  - Editor in Tabs: Allgemein (inkl. Tags), Beschreibung, Add-ons & Mitwirkende, Bilder, Downloads. Neue Projekte zeigen nur die ersten drei und landen nach dem Anlegen im Tab Bilder. Fehlerhafte Tabs werden markiert und geöffnet, offene Checklistenpunkte führen zum passenden Tab, der Tab steht im Anker der Adresse (`#media`).
  - Titelbild und Screenshots, Versionen mit Links
  - Voraussetzungen & benötigte Add-ons als Liste (`ProjectRequirement`: Name, optionaler Link, `FREEWARE`/`PAYWARE`); das frühere Freitextfeld ist mit der Migration `project_requirements` entfallen. Namen fließen in die Suchspalte ein.
  - Statusablauf DRAFT → PENDING_REVIEW → PUBLISHED/REJECTED, dazu ARCHIVED; HIDDEN setzt nur die Moderation
- **Admin (`/admin/*`):**
  - Freigeben, Zurückweisen und Ausblenden mit Begründung
  - Meldungen bearbeiten
  - Konten sperren (beendet Sitzungen, optional Projekte ausblenden; Admins und das eigene Konto sind ausgenommen)
  - Kategorien und Tags verwalten, Protokoll
  - Admin-Rechte nur per CLI: `pnpm user:set-role <mail> admin`
- **E-Mails an Creator** bei Freigabe, Zurückweisung, Ausblenden und Wiedereinblenden (`src/server/emails.ts`).
- **`/api/health`** prüft die Datenbank und wird für Monitoring und Deployment genutzt.

## Wichtige Entscheidungen und Fallstricke

- **Caching** (`src/server/public-cache.ts`):
  - Listen haben den Tag `public:lists` und werden per `revalidateTag(…, "max")` erneuert (stale-while-revalidate).
  - Detailseiten, Creator und Kategorien/Tags werden per `updateTag` sofort invalidiert.
  - Lebensdauer `minutes`, bei Kategorien und Tags `hours`; Zähler sind deshalb bis zu einige Minuten alt.
  - Ein einziger grober Tag hatte gemessen alle Prefetches blockierend neu rendern lassen; deshalb die feinere Aufteilung.
  - `next build` braucht Datenbankzugriff, weil die Seitenhüllen mit Daten vorgerendert werden.
- **Echter 404:** Der Proxy prüft Projekte, Kategorien, Creator und Rechtsseiten vor dem Rendern (`src/server/route-existence.ts`). `ensureStatic` scheidet aus, weil Session-Header und `searchParams` das verhindern.
- **`getCurrentUser()`** ruft vor Better Auth `connection()` auf, sonst kommt es beim Runtime-Prefetch zum Fehler „blocking-prerender-current-time“. `cookies()` wird *vor* `connection()` gelesen.
- **Direkte `auth.api`-Aufrufe** umgehen Rate-Limit und Origin-Prüfung von Better Auth. Deshalb haben die Server Actions eigene Limits (`src/server/rate-limit.ts`, Präfix `app:`).
- **Zustimmung zu den Nutzungsbedingungen:** Fassungen stehen in `TERMS_VERSIONS` (`src/lib/legal.ts`: Version, `effectiveFrom`, Änderungen DE/EN), Texte unter `content/legal/terms/<version>.<sprache>.md`. Neue Konten speichern `User.termsVersion`/`termsAcceptedAt` (Hook `databaseHooks.user.create.before`). Wer der neuesten Fassung nicht zugestimmt hat (auch ohne gespeicherte Zustimmung), sieht nach der Anmeldung ein Popup (`TermsGate` im Layout): akzeptieren oder – nach Passwortbestätigung – Konto schließen (gemeinsamer Ablauf `deleteOwnAccount` in `src/server/own-account-deletion.ts`, Protokoll `reason: terms_declined`). Auf den Rechtsseiten bleibt das Popup zu. `/legal/terms` zeigt die geltende Fassung, kündigt eine spätere an und zeigt Fassungen per `?fassung=`. Zusätzlich serverseitig gesperrt: `getActingUser()` (`src/server/session.ts`) liefert `terms_required` für Profil, Creator-Profil, Projekte, Meldungen mit Konto und alle Admin-Aktionen. Erlaubt bleiben Anmelden/Abmelden, Passwort, E-Mail, Sitzungen, die Popup-Aktionen und das Löschen des eigenen Kontos (dort `getCurrentUser()`). Neue Actions, die Inhalte ändern, müssen `getActingUser()` verwenden. Ablauf für eine neue Fassung: Kommentar in `src/lib/legal.ts`.
- **Über HTTP gesperrt** (`disabledPaths` in `src/lib/auth.ts`): `/sign-up/email`, `/change-email`, `/update-user`, `/list-sessions`, `/send-verification-email` und alle `emailOTP`-Endpunkte. Sie laufen nur über Server Actions mit Passwortabfrage und Validierung. Wer eine neue Oberfläche baut, die Better Auth direkt aus dem Browser nutzt, muss das berücksichtigen.
- **PostgreSQL:** `contains` unterscheidet Groß- und Kleinschreibung; für Anzeigename und Name wird `mode: "insensitive"` verwendet. Enums sind native PostgreSQL-Typen. Die SQLite-Migrationen wurden durch eine neue Initial-Migration ersetzt.
- **pnpm:**
  - `minimumReleaseAge` ist aktiv; frische Pakete brauchen eine Ausnahme in `pnpm-workspace.yaml`.
  - `better-sqlite3` kommt nur indirekt über Prisma Studio mit, `allowBuilds` steht dafür auf `false`.
- **Bekannter Next-Bug im Dev-Modus** (16.4.2): Gelegentlich erscheint „Received an underlying cookies object that does not match …“. In Produktion tritt er nicht auf. E2E-Tests deshalb nur gegen `pnpm build && pnpm start`.
- **E2E:**
  - Timeout 60 s, weil Abläufe mit mehreren Konten unter Last 15–25 s brauchen.
  - Der Testserver schreibt Mails nach `.e2e-mail` (`DEV_MAIL_DIR`), nicht in `.dev-mail`; gesucht wird über den Zeitstempel im Dateinamen.
  - Kein `reuseExistingServer`: Ist Port 3000 belegt (z. B. `pnpm dev` oder ein hängengebliebener Testserver), bricht der Lauf ab. Unter Windows bleibt nach einem abgebrochenen Lauf gelegentlich ein `next start` übrig; dann den Prozess auf Port 3000 beenden.
  - Das Aufräumskript `scripts/cleanup-e2e.ts` entfernt Konten unter `@e2e.example.com`, Test-Kategorien und -Tags mit Präfix `e2e-` sowie die Test-Mails.
- **Windows-Werkzeuge:** Python schreibt im Textmodus CRLF und interpretiert Backslashes. Für Dateiänderungen besser Edit/Write oder Raw-Strings in einem Skript im Scratchpad nutzen; Git normalisiert beim Commit (`.gitattributes`, `deploy/**` immer mit LF).

## Beta-Server

| | |
|---|---|
| Server | Hetzner Cloud, Ubuntu 24.04, IPv4 `<SERVER-IPv4>`, IPv6 `<SERVER-IPv6>` |
| Domain | `beta.omsi-modhub.de`: A- und AAAA-Eintrag beim Domain-Provider, keine Weiterleitung |
| Nutzer | Admin per SSH: `<ADMIN-BENUTZER>`. Dienstnutzer: `omsi` (Deploy, Backup, CLI) |
| Dienste | `caddy` (HTTPS über Let's Encrypt, Basic Auth, noindex), `omsi-mod-hub` (Next auf 127.0.0.1:3000), `postgresql` (18, nur localhost), Timer `omsi-mod-hub-backup` (täglich 03:30) |
| Pfade | Releases unter `/opt/omsi-mod-hub/releases`, Symlink `current`, Skripte `deploy.sh` und `backup.sh` unter `/opt/omsi-mod-hub/`, Konfiguration in `/etc/omsi-mod-hub/env` (600, enthält `DATABASE_URL` und die Secrets), Daten unter `/var/lib/omsi-mod-hub/{uploads,backups}` (750, nur `omsi`; für den Admin `sudo ls`) |
| Datenbank | Rolle und Datenbank `omsi_mod_hub`, Passwort nur in der Env-Datei |
| E-Mail | SMTP-Postfach `no-reply@omsi-modhub.de` bei **dogado** (Versand über `secure-mailgate.com`). SPF `v=spf1 include:secure-mailgate.com ?all` besteht, DMARC besteht, **DKIM schlägt noch fehl** |

**Betrieb:**
- Update: `sudo -iu omsi /opt/omsi-mod-hub/deploy.sh`. Das Skript holt `main`, baut in einem neuen Release, schaltet um, prüft die Health-Route und stellt bei einem Fehler automatisch zurück. `INITIAL_SEED=1` nur bei einer leeren Datenbank verwenden, weil der Seed Kategorie-Namen und Icons überschreibt.
- Logs: `journalctl -u omsi-mod-hub`, Caddy unter `/var/log/caddy/`.
- Backup: `pg_dump` im Custom-Format plus Uploads als tar.gz, 14 Tage aufbewahrt. Wiederherstellen steht im Kopf von `deploy/backup.sh`.
- **Nach dem Neustart zu erledigen:** Admin-Konto neu angelegt, Backup getestet. Noch offen bzw. vom Nutzer zu bestätigen: SQLite-Archiv und das Paket `sqlite3` entfernen (Schritt 10 in DEPLOYMENT.md).
- Bei der Einrichtung behobene Stolpersteine, jetzt in der Doku:
  - Der Ordner `.ssh` fehlte beim Systemnutzer.
  - Das Caddy-Log gehörte nach `caddy validate` dem Nutzer root.
  - Der AAAA-Eintrag enthielt `/64` bzw. `eth0 UP`.
  - Gmail lehnte Mails ab, bevor SPF eingerichtet war.

## Lokale Entwicklung

- PostgreSQL 18 als Windows-Dienst `postgresql-x64-18`, Rolle `omsi_mod_hub` mit CREATEDB, Datenbank `omsi_mod_hub`; Zugangsdaten in `.env`. `psql` liegt unter `C:\Program Files\PostgreSQL\18\bin\`.
- Die alte SQLite-Datei `prisma/dev.db` (gitignored) enthält noch das `test-projekt` des Nutzers. Nicht löschen.
- Ablauf: `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`. Prüfen mit `pnpm check` (Typecheck, Lint, Unit-Tests), `pnpm build`, `pnpm test:e2e` (Port 3000, `MAIL_TRANSPORT=file`).
- SMTP-Test: `pnpm mail:test <adresse>`.

## Offene Punkte

1. **DKIM** bei dogado aktivieren bzw. den DNS-Schlüssel prüfen. Danach SPF von `?all` auf `~all` umstellen.
2. **Vor einem öffentlichen Start:**
   - Nutzungsbedingungen rechtlich prüfen lassen, danach `terms` aus `DRAFT_PAGES` entfernen; Datenschutzerklärung ergänzen (E-Mail-Versand über dogado, Cookies, Sitzungsdaten) und prüfen lassen
   - Basic Auth und noindex entfernen
   - Content-Security-Policy ergänzen
   - Backup außerhalb des Servers einrichten (Storage Box) und die Wiederherstellung auf dem Server testen
   - Monitoring auf `/api/health`, z. B. mit UptimeRobot
3. **Rechtliche Restpunkte aus der WBS-Plausibilitätsprüfung (18.10.2026):** anwaltlich klären, welche DSA-Pflichten gelten (Meldeverfahren, Begründung, Beschwerdeweg); Haftungsregelung für eigene Inhalte und technische Fehler; Änderungsverfahren der Bedingungen. Technisch fehlt dafür noch: E-Mail an gesperrte Nutzer mit Begründung, ein Beschwerdeweg gegen Moderationsentscheidungen, Linkstatus „gesperrt“ im Adminbereich setzen.
4. **Payware kennzeichnen:** Projekte brauchen ein Merkmal „kostenpflichtig“ mit Badge (wie bei den Voraussetzungen); bis dahin verlangen die Nutzungsbedingungen die Angabe in Kurzbeschreibung und Lizenz.
5. **Moderation:** Projekte einer anderen Kategorie zuordnen, Protokoll filtern, Linkstatus aus Meldungen setzen.
6. **Benachrichtigungen:** Versand-Warteschlange mit Wiederholung, Abmeldeoption.
7. **Skalierung:** Objektspeicher für Bilder, PostgreSQL-Volltextsuche bzw. `pg_trgm`, gemeinsamer Cache-Handler bei mehreren Instanzen.
8. **Smoke-Skript:** Es lag nur im Scratchpad der Sitzung. Seine Klickzähler-Prüfungen erwarten noch Werte ohne Cache; bei Bedarf neu und an das Caching angepasst schreiben.
