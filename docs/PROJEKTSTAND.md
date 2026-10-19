# Projektstand OMSI Mod Hub

Stand: **18.10.2026**. Diese Datei fasst zusammen, was gebaut wurde, warum Entscheidungen so gefallen sind und was offen ist. Details stehen in [README.md](../README.md), [ARCHITECTURE.md](ARCHITECTURE.md) und [DEPLOYMENT.md](DEPLOYMENT.md).

## Kurzfassung

- Zweisprachiges (DE/EN) Katalogportal für OMSI-2-Mods. **Es werden keine Mod-Dateien gehostet**, nur externe Links. Zielgruppe ist international, die Standardsprache Englisch.
- Fertig sind: öffentlicher Katalog, Konten (inklusive E-Mail ändern, Geräteübersicht, Konto löschen), Creator-Dashboard, Adminbereich, Caching mit echten 404-Statuscodes, Deployment, Datenbank PostgreSQL.
- **Geschlossene Beta live** unter `https://beta.omsi-modhub.de`, hinter Basic Auth, nicht indexiert. Betrieb auf einem eigenen Server nach [DEPLOYMENT.md](DEPLOYMENT.md).
- Tests: 127 Unit-Tests (Vitest) und 52 E2E-Tests (Playwright) sind grün, gegen PostgreSQL 18.

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
  - Rechtsseiten: Impressum mit den echten Angaben (Adresse über online-impressum.de, `kontakt@omsi-modhub.de`); Datenschutzerklärung (WBS-Generator, ergänzt um 25 Abschnitte inkl. Konto, Cookies, checkdomain, Löschfristen; Stand 19.10.2026) als Datei `content/legal/privacy.de.md` (eigener kleiner Markdown-Parser `src/lib/legal-markdown.ts` mit Listen, Tabellen und Code, englische Seite mit Hinweis „nur Deutsch“); Nutzungsbedingungen als versionierte Dateien unter `content/legal/terms/` (Regeln: Konto ab 16, fremde Projekte nur mit Erlaubnis, Payware gekennzeichnet, Haftung und Rechtswahl nach Vorgabe des Betreibers), rechtlich geprüft (19.10.2026), ohne Entwurfshinweis. SEO, Sitemap, Dark Mode
- **Konten:** Registrierung in zwei Schritten mit Fortschrittsanzeige: Kontodaten, dann 6-stelliger Code (Seite `/confirm-email`, eine Box pro Ziffer, Code erneut senden – danach 5 Minuten Sperre mit Countdown „Neuer Code verfügbar in m:ss“, serverseitig erzwungen (`src/server/resend-cooldown.ts`), Adresse über Schritt 1 korrigieren); Hinweise dort blenden sich nach 5 Sekunden aus, mit Countdown-Ring, Pause bei Maus/Fokus – `AutoDismissAlert`, Registrierung mit schon vergebener Adresse: gleiche Oberfläche, aber Hinweis-Mail „Du hast bereits ein Konto“ an den Inhaber statt eines Codes. Login per E-Mail oder Benutzername, Passwort vergessen, Einstellungen. Dazu E-Mail ändern (Link an alte, dann an neue Adresse), angemeldete Geräte anzeigen und abmelden, Konto löschen (mit allen Projekten und Bildern; Admins ausgenommen).
- **Creator-Dashboard:**
  - Creator-Profil anlegen, Projekt-Editor zweisprachig
  - Editor in Tabs: Allgemein (inkl. Tags), Beschreibung, Add-ons & Mitwirkende, Bilder, Downloads. Neue Projekte zeigen nur die ersten drei und landen nach dem Anlegen im Tab Bilder. Fehlerhafte Tabs werden markiert und geöffnet, offene Checklistenpunkte führen zum passenden Tab, der Tab steht im Anker der Adresse (`#media`).
  - Titelbild und Screenshots, Versionen mit Links
  - Textformatierung in Beschreibung und Installationsanleitung: Werkzeugleiste (fett, kursiv, unterstrichen, zwei Überschriftenebenen, Punkt- und Nummernlisten, Strg+B/I/U) mit Vorschau. Gespeichert wird Text mit Markdown-ähnlichen Zeichen (`**`, `*`, `++`, `##`, `-`, `1.`); bestehende Beschreibungen bleiben unverändert gültig. Links bewusst nicht. Changelogs sind weiterhin reiner Text.
  - Voraussetzungen & benötigte Add-ons als Liste (`ProjectRequirement`: Name, optionaler Link, `FREEWARE`/`PAYWARE`); das frühere Freitextfeld ist mit der Migration `project_requirements` entfallen. Namen fließen in die Suchspalte ein.
  - Projekte als Freeware oder Payware (`Project.pricing`, Enum `RequirementPricing`, Migration `project_pricing`): Auswahl im Editor-Tab „Allgemein“, Badge nur bei Payware (Karten, Projektseite, Freigabeliste), Downloadbuttons „Zum Shop“ mit Hinweis zum Kauf beim Anbieter, Preisfilter `?price=free|paid` im Katalog. Auch Voraussetzungen heißen bei Payware „Zum Shop“. Die Nutzungsbedingungen nennen die Kennzeichnung nur als Beispiel; bei der nächsten Fassung auf das Merkmal verweisen.
  - Statusablauf DRAFT → PENDING_REVIEW → PUBLISHED/REJECTED, dazu ARCHIVED; HIDDEN setzt nur die Moderation
- **Admin (`/admin/*`):**
  - Freigeben, Zurückweisen und Ausblenden mit Begründung
  - Meldungen bearbeiten
  - Konten sperren (beendet Sitzungen, optional Projekte ausblenden; Admins und das eigene Konto sind ausgenommen)
  - Kategorien und Tags verwalten, Protokoll
  - Admin-Rechte nur per CLI: `pnpm user:set-role <mail> admin`
- **E-Mails an Creator** bei Freigabe, Zurückweisung, Ausblenden und Wiedereinblenden (`src/server/emails.ts`).
- **Löschfristen:** täglicher Timer `omsi-mod-hub-cleanup` (`pnpm data:cleanup`): Rate-Limit-Einträge mit IP-Adressen nach 24 Stunden, abgelaufene Sitzungen und Codes, unbestätigte Konten nach 7 Tagen, abgeschlossene Meldungen nach 6 Monaten, Protokolleinträge nach 12 Monaten; Caddy-Logs höchstens 14 Tage. Alle Fristen samt Backups (14 Tage) stehen in Abschnitt 10 der Datenschutzerklärung. Auf der Beta einmalig einrichten (DEPLOYMENT.md, Betrieb).
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

## Offene Punkte

1. **Vor einem öffentlichen Start:**
   - Datenschutzerklärung ergänzen (E-Mail-Versand, Cookies, Sitzungsdaten) und prüfen lassen
   - Basic Auth und noindex entfernen
   - Backup außerhalb des Servers einrichten (Storage Box) und die Wiederherstellung auf dem Server testen
   - Monitoring auf `/api/health`, z. B. mit UptimeRobot
2. **Rechtliche Restpunkte:** klären, welche DSA-Pflichten gelten (Meldeverfahren, Begründung, Beschwerdeweg); Haftungsregelung für eigene Inhalte und technische Fehler; Änderungsverfahren der Bedingungen. Technisch fehlt dafür noch: E-Mail an gesperrte Nutzer mit Begründung, ein Beschwerdeweg gegen Moderationsentscheidungen, Linkstatus „gesperrt“ im Adminbereich setzen.
3. **Moderation:** Projekte einer anderen Kategorie zuordnen, Protokoll filtern, Linkstatus aus Meldungen setzen.
4. **Benachrichtigungen:** Versand-Warteschlange mit Wiederholung, Abmeldeoption.
5. **Skalierung:** Objektspeicher für Bilder, PostgreSQL-Volltextsuche bzw. `pg_trgm`, gemeinsamer Cache-Handler bei mehreren Instanzen.
