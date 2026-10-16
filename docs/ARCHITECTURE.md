# Architektur und Entscheidungen

Dieses Dokument hält Entscheidungen fest, die später schwer zu ändern sind, und begründet sie.

## Überblick

```
Browser ──► proxy.ts (Sprache erkennen, /xx-Präfix erzwingen)
              │
              ▼
        app/[locale]/…  Server Components (RSC)
              │   lesen über
              ▼
        server/data/*   ──► lib/db.ts (Prisma Client + Driver Adapter) ──► SQLite / PostgreSQL
        server/actions/* (Server Actions, Zod-Validierung, Rate-Limit)

        app/go/[linkId]  Route Handler: zählt Aufruf, 302 zur gespeicherten externen URL
```

- **Lesen:** ausschließlich in Server Components über `src/server/data`. Alle öffentlichen Abfragen filtern auf `status = PUBLISHED`.
- **Schreiben:** Server Actions in `src/server/actions` mit Zod-Validierung und Rate-Limit. Jede Action prüft Anmeldung und Berechtigung selbst über `src/server/session.ts` – nie nur über ausgeblendete UI.
- **Reine Logik** (URL-Validierung, Suchnormalisierung, Parameter-Parsing, Übersetzungs-Fallback) liegt in `src/lib` ohne Framework-Abhängigkeiten und ist mit Unit-Tests abgedeckt.

## Entscheidungen

### ORM: Prisma 7 (statt Drizzle)

Prisma erlaubt den Wechsel SQLite → PostgreSQL durch Änderung des `provider` und des Driver Adapters, ohne das Schema neu zu schreiben (Drizzle hätte getrennte `sqlite-core`/`pg-core`-Schemas). Das Schema verwendet deshalb keine providerspezifischen Typen (`@db.*`). Prisma `latest` zeigte zum Zeitpunkt der Einrichtung auf einen Release Candidate (8.0.0-rc); verwendet wird die stabile **7.10.1**. Die Konfiguration liegt in `prisma7.config.ts` (der von Prisma 7.10 bevorzugte Dateiname).

### Datenbank: SQLite lokal, PostgreSQL als Ziel

Auf Wunsch wird zunächst SQLite verwendet. Migrationen sind providerspezifisch – beim Umstieg wird die Initial-Migration neu erzeugt (siehe README). Vorher sollten keine Produktivdaten in SQLite entstehen.

### Rendering: Cache Components, Daten pro Request

`cacheComponents` ist aktiv (Standard von create-next-app 16.4). Synchrone SQLite-Abfragen würden sonst beim Build statisch eingebrannt. Daher ruft jede öffentliche Datenfunktion `await connection()` auf und wird in `<Suspense>` gerendert: Header, Footer und Seitengerüst werden vorgerendert, Daten streamen pro Request.

**Geplante Optimierung:** Öffentliche Lesefunktionen auf `'use cache'` + `cacheLife` + `cacheTag` umstellen und bei Änderungen (Dashboard/Admin) per `revalidateTag`/`updateTag` invalidieren. Für Detailseiten zusätzlich `ensureStatic = "navigation"`, damit der erste Request auf das fertige Ergebnis wartet und unbekannte Slugs einen **echten 404-Status** liefern (derzeit: 404-Seite mit `noindex`, aber HTTP 200 – dokumentiertes Verhalten von Next.js ≥ 16.3, weil zuerst die App-Hülle gestreamt wird). `instant = false` allein löst das nicht.

### Internationalisierung: next-intl mit `next/root-params`

- Routen immer mit Präfix (`/de/…`, `/en/…`), damit jede Sprachversion eine eigene, indexierbare URL mit hreflang-Alternativen hat.
- Gäste erhalten die Sprache über `Accept-Language`; Fallback ist **Englisch** (internationales Publikum). Änderbar in `src/i18n/routing.ts`.
- Die Sprache wird über `next/root-params` gelesen (von next-intl empfohlen, `setRequestLocale` ist veraltet).
- An den Browser werden nur die Übersetzungs-Namespaces gesendet, die Client-Komponenten benötigen (`Report`, `Errors`).
- Inhalte: `ProjectTranslation`, `CategoryTranslation`, `TagTranslation` je Sprache (eindeutig pro Datensatz + Sprache). Fehlt eine Übersetzung, wird die Originalsprache (`Project.defaultLocale`) angezeigt – mit Hinweis und korrektem `lang`-Attribut.
- **Kategorie-Slugs sind sprachneutral** (`/en/mods/busse`), wie in der Routenplanung vorgegeben. Lokalisierte Slugs wären über next-intl `pathnames` nachrüstbar.

### Routing von `/mods/[slug]`

Kategorien und Projekte teilen sich `/mods/[slug]`. Kategorie-Slugs haben Vorrang. Beim Anlegen von Projekten muss geprüft werden, dass der Slug keinem Kategorie-Slug entspricht (der Seed prüft das bereits).

### Suche

Pro Übersetzung wird eine normalisierte, kleingeschriebene Suchspalte `searchText` gespeichert (Titel, Kurzbeschreibung, Beschreibung, Tag-Namen aller Sprachen). Suchbegriffe werden identisch normalisiert, SQL-Wildcards entfernt, auf 6 Begriffe begrenzt und per `contains` (UND-verknüpft) abgefragt. Vorteile: identisches Verhalten auf SQLite und PostgreSQL, korrekte Groß-/Kleinschreibung bei Umlauten, keine Rohabfragen. **Pflicht beim Schreiben:** `searchText` muss bei jeder Änderung von Texten oder Tags über `buildSearchText()` neu berechnet werden.

Ausbaupfad: PostgreSQL `tsvector` mit GIN-Index für Relevanz oder `pg_trgm` für Teilstrings; die Filterstruktur (`buildCatalogWhere`) ist so angelegt, dass weitere Filter (Fahrzeugtyp, Verkehrsunternehmen, Sprache, Add-ons, Kompatibilität) als zusätzliche `AND`-Bedingungen ergänzt werden können.

### Externe Links

- Gespeichert als eigene Datensätze (`ExternalLink`) pro Version, mit Anbieter, Quellentyp, Status und Prüfzeitpunkt.
- `parseExternalUrl()` akzeptiert nur öffentliche `http(s)`-Ziele ohne Zugangsdaten und lehnt lokale/private Hosts ab. Eine spätere automatische Linkprüfung muss zusätzlich die **per DNS aufgelöste IP** prüfen (DNS-Rebinding) und darf Weiterleitungen nur nach erneuter Prüfung folgen.
- Downloads laufen über `/go/[linkId]`: Weiterleitung nur auf die gespeicherte URL (kein Open Redirect), `nofollow`, `noindex`, in robots.txt gesperrt. Gezählt werden **Aufrufe externer Seiten**, ausdrücklich keine Downloads. Das Zählen nutzt rohes, parametrisiertes SQL, damit `updatedAt` des Projekts unverändert bleibt.
- „Beliebt“ basiert ausschließlich auf diesen gemessenen Aufrufen; ohne Daten zeigt die Startseite einen Leerzustand.

### Authentifizierung: Better Auth (statt Auth.js)

Auth.js v5 ist seit Jahren im Beta-Stadium, die stabile v4 ist nicht für den App Router gebaut, und E-Mail/Passwort müsste dort selbst implementiert werden. Better Auth (1.7.10, fest angeheftet) bringt Passwort-Hashing (scrypt), E-Mail-Bestätigung, Passwort-Reset, Datenbank-Sessions, Rate-Limits sowie Plugins für Benutzernamen und Rollen/Sperren mit.

- **Konfiguration:** `src/lib/auth.ts`. Schema-Tabellen `User`, `Session`, `Account` (Passwort-Hash), `Verification`, `RateLimit` folgen dem Better-Auth-Schema; IDs vergibt die Datenbank (`generateId: false`).
- **E-Mail-Bestätigung ist Pflicht** (`requireEmailVerification`). Dadurch antwortet Better Auth bei bereits registrierter E-Mail mit einer synthetischen Erfolgsantwort (kein Ausspähen registrierter Adressen); die Mail wird ohne `await` versendet, damit auch die Antwortzeit nichts verrät. Nach Klick auf den Link ist man angemeldet (`autoSignInAfterVerification`).
- **Formulare nutzen Server Actions**, die `auth.api.*` direkt aufrufen (funktioniert ohne JavaScript, Fehler werden lokalisiert). Wichtig: Direkte API-Aufrufe umgehen Rate-Limit und Origin-Prüfung des Better-Auth-Routers. Deshalb hat jede Auth-Action ein eigenes, datenbankgestütztes Rate-Limit (IP **und** Konto/E-Mail); CSRF-Schutz übernimmt Next.js für Server Actions. Die HTTP-Endpunkte unter `/api/auth/*` (u. a. für Links aus E-Mails) haben zusätzlich das Better-Auth-Rate-Limit (Speicher: Datenbank, auch lokal aktiv).
- **Sessions:** 30 Tage, täglich verlängert, in der Datenbank (sofort widerrufbar). Kein Cookie-Cache, damit Sperren und Rollenänderungen sofort greifen. `getCurrentUser()` liest die Session mit dem aktuellen Cookie-Stand (`cookies()`), damit nach einer Action mit neuer Session (z. B. Passwortwechsel) nicht kurzzeitig ein abgemeldeter Zustand gerendert wird.
- **Autorisierung:** Data Access Layer in `src/server/session.ts` (`getCurrentUser`, `requireUser`, `requireAdmin`, `assertAdmin`). Session-Lesezugriffe stehen gemäß Cache-Components-Leitfaden immer hinter `<Suspense>`, nie im Layout. Der Proxy leitet ohne Session-Cookie nur vorab um; maßgeblich ist die Prüfung in Seite, Action bzw. Datenfunktion. Nicht-Admins erhalten für `/admin` eine 404.
- **Weiterleitungen nach dem Login** (`?next=`) werden mit `safeRedirectPath()` auf lokalisierte, relative Pfade beschränkt – geprüft nach der Normalisierung (Open-Redirect-Schutz).
- **E-Mail:** `src/server/mail.ts` mit Transporten `file` (Entwicklung/E2E), `console` und `smtp` (nodemailer). Texte lokalisiert nach `User.preferredLocale`.

### Creator-Dashboard und Projektverwaltung

- **Creator werden:** Self-Service für bestätigte Konten (Creator-Profil anlegen). Die Rolle `creator` wird per Server Action direkt in der Datenbank ergänzt – nicht über die Auth-API, wo sie kein Eingabefeld ist – und im Audit-Log festgehalten. Admins haben ebenfalls Creator-Rechte.
- **Autorisierung:** Alle Editor-Abfragen und -Actions filtern auf `creatorId = aktueller Nutzer` (`src/server/data/creator-projects.ts`, `ownProject()` in den Actions). Eine manipulierte Projekt-ID führt zu „nicht gefunden“ (per E2E-Test geprüft). Die Vorschau erlaubt zusätzlich Admins.
- **Statusmodell** (`src/lib/project-status.ts`, unit-getestet): Creator dürfen `DRAFT/REJECTED → einreichen`, `PENDING_REVIEW → zurückziehen`, `DRAFT/REJECTED/PUBLISHED → archivieren`, `ARCHIVED → Entwurf`. `PENDING_REVIEW → PUBLISHED/REJECTED` und `HIDDEN` sind Admins vorbehalten. In Prüfung und bei Moderation ist der Inhalt gesperrt. Mit `PROJECT_REVIEW_REQUIRED=false` veröffentlicht „Einreichen“ direkt. Eine serverseitige Checkliste prüft vor dem Einreichen die Pflichtangaben.
- **Bearbeitung veröffentlichter Projekte** wirkt sofort (keine erneute Prüfung) – bewusste MVP-Entscheidung; Missbrauch wird über Meldungen und künftiges Ausblenden abgefangen. Das URL-Kürzel ist ab der ersten Veröffentlichung unveränderlich und darf nie einem Kategorie-Slug entsprechen.
- **Formulare:** Server Actions mit Zod; verschachtelte Feldnamen (`translations.de.title`, `links.0.url`) werden in `src/lib/project-form.ts` gelesen, Fehler unter demselben Pfad zurückgegeben. Der Editor sendet per Transition, damit React große Formulare bei Validierungsfehlern nicht zurücksetzt; ohne JavaScript funktionieren sie über das `action`-Attribut. Nach Änderungen aktualisiert `refresh()` die Ansicht.
- **Suchtext** wird nach jeder Text- oder Tag-Änderung in derselben Transaktion neu berechnet (`rebuildSearchText`).
- **Downloadlinks** werden beim Speichern normalisiert, der Anbieter serverseitig aus der URL abgeleitet; geänderte Ziele gelten wieder als „nicht geprüft“, Klickzahlen bleiben erhalten.

### Bild-Uploads

- Prüfung: Dateigröße ≤ 5 MB, Format anhand der Datei-Signatur (JPEG/PNG/WebP – Dateiname und MIME-Typ werden ignoriert, SVG ist ausgeschlossen), Mindestkantenlänge, Pixel-Limit gegen Dekompressionsbomben.
- Verarbeitung mit `sharp`: EXIF-Ausrichtung anwenden, auf max. 1920 px verkleinern, **neu als WebP kodieren** – dabei gehen Metadaten (z. B. GPS) und eingebettete Fremdinhalte verloren.
- Ablage unter zufälligem Schlüssel (`<32 hex>.webp`) in `UPLOAD_DIR` außerhalb von `public/`; Auslieferung über `/media/[key]` mit strenger Schlüsselprüfung (kein Path Traversal), `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` und unveränderlichem Caching. Ersetzte oder gelöschte Bilder werden auch von der Platte entfernt.
- Server Actions akzeptieren dafür bis 6 MB (`experimental.serverActions.bodySizeLimit`).

### Rollen und Moderation

`User.role` ist ein String (`user`, `creator`, `admin`), weil das Admin-Plugin Rollen als Text (auch kommagetrennt) speichert; geprüft wird über `hasRole()`. Rollen sind kein Eingabefeld: weder bei der Registrierung noch über `update-user` setzbar, und die Admin-Endpunkte erfordern die Rolle `admin` (per E2E-Test geprüft). Das erste Admin-Konto entsteht über das lokale CLI-Skript `pnpm user:set-role` (mit Audit-Log); es gibt keinen Seed und keine Web-Route dafür. Sperren laufen über `banned`/`banReason`/`banExpires` des Admin-Plugins; gesperrte Konten gelten in `getCurrentUser()` als abgemeldet und erscheinen nicht öffentlich. Projekte haben einen Status-Lebenszyklus (DRAFT → PENDING_REVIEW → PUBLISHED, außerdem REJECTED/HIDDEN/ARCHIVED) für reversible Moderation statt Löschung.

**Adminbereich** (`/admin/*`, Seiten unter `src/app/[locale]/admin`):

- **Prüfung an drei Stellen:** jede Seite (`requireAdmin`), jede Datenfunktion (`assertAdmin`) und jede Action (`adminActor()` in `src/server/admin-action.ts` bzw. `currentAdmin()` in `review.ts`). Das Layout rendert die Admin-Navigation nur für Admins (hinter `<Suspense>`), damit der Bereich für andere nicht erkennbar ist. Admin-Actions haben ein Rate-Limit pro Konto (120/min) gegen versehentliche Massenänderungen.
- **Statusregeln** als reine Funktionen in `src/lib/moderation.ts` (unit-getestet): `approve`/`reject` nur aus `PENDING_REVIEW`, `hide` nur aus `PUBLISHED`, `unhide` nur aus `HIDDEN`; Zurückweisen und Ausblenden verlangen eine Begründung (`moderationNote`, für den Creator sichtbar). Meldungen: `OPEN → IN_REVIEW → RESOLVED/DISMISSED`, abgeschlossene lassen sich wieder öffnen; `Report.resolutionNote` ist intern.
- **Gleichzeitige Entscheidungen:** Statuswechsel laufen als bedingtes `updateMany` (`where: { id, status: alterStatus }`); die zweite Entscheidung erhält „nicht möglich“ statt den Zustand zu überschreiben.
- **Sperren** schreiben direkt `banned`/`banReason`/`banExpires` und löschen alle Sessions des Kontos in einer Transaktion (statt `auth.api.banUser`, um die Prüfung im eigenen DAL zu halten). Beim Login weist Better Auth gesperrte Konten ab und hebt abgelaufene Sperren selbst auf. Eigenes Konto und Admins sind ausgenommen (`canBanUser`).
- **Kategorien/Tags:** Kürzel sind nach dem Anlegen fest. Ein neues Kategorie-Kürzel darf keinem Projekt-Slug entsprechen, weil Kategorien in `/mods/[slug]` Vorrang haben. Kategorien sind nur ohne Projekte und Unterkategorien löschbar (zusätzlich `onDelete: Restrict`). Umbenennen oder Löschen eines Tags berechnet die Suchspalte der betroffenen Projekte in derselben Transaktion neu.
- **Benachrichtigungen:** Nach jeder Projektentscheidung geht eine Klartext-Mail in der bevorzugten Sprache des Creators raus (`projectDecisionEmail` in `src/server/emails.ts`), ohne auf den Versand zu warten. Links zeigen bei Freigabe/Wiedereinblenden auf die öffentliche Seite, sonst ins Dashboard.
- **Audit-Log:** Jede Admin-Aktion schreibt einen Eintrag (Aktion, Objekt, Zusatzdaten als JSON); Ansicht unter `/admin/audit`.

### Sicherheit

- Nutzertexte werden als Text gerendert (kein `dangerouslySetInnerHTML`, kein Markdown) → kein XSS über Projekttexte. Markdown käme nur mit Sanitizer.
- Datenbankzugriff nur über Prisma bzw. parametrisierte Tagged Templates → kein SQL-Injection-Risiko.
- Server Actions prüfen den Origin (CSRF-Schutz von Next.js). Meldungen: Zod, Honeypot, Rate-Limit (5 pro 10 Minuten). Rate-Limit-Zähler liegen in der Tabelle `RateLimit`; IP-Adressen werden dort nur als Hash gespeichert.
- Fehlerseiten zeigen keine internen Details; Server-Logs enthalten keine personenbezogenen Daten.
- Header: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, kein `X-Powered-By`. **Offen:** Content-Security-Policy (mit Nonces, kompatibel zu PPR).

### UI

Eigene, kleine Komponenten statt shadcn-CLI, um Abhängigkeiten gering zu halten: Button, Badge, Container, EmptyState/Skeleton/Notice, SectionHeading. Design-Tokens in `src/app/globals.css` (`@theme`). Sortierung und Filter sind Links bzw. GET-Formulare und funktionieren ohne JavaScript. Mit Cache Components bleiben vorherige Routen per React `<Activity>` versteckt im DOM erhalten – E2E-Tests müssen Locators daher eindeutig wählen.

## Geplante Tabellen

`Favorite`, `Comment`, `Rating` und `ProjectDependency` (benötigte Add-ons als Beziehung statt Freitext) werden angelegt, sobald die jeweilige Funktion umgesetzt wird.
