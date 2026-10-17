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
        server/data/*   ──► lib/db.ts (Prisma Client + Driver Adapter) ──► PostgreSQL
        server/actions/* (Server Actions, Zod-Validierung, Rate-Limit)

        app/go/[linkId]  Route Handler: zählt Aufruf, 302 zur gespeicherten externen URL
```

- **Lesen:** ausschließlich in Server Components über `src/server/data`. Alle öffentlichen Abfragen filtern auf `status = PUBLISHED`.
- **Schreiben:** Server Actions in `src/server/actions` mit Zod-Validierung und Rate-Limit. Jede Action prüft Anmeldung und Berechtigung selbst über `src/server/session.ts` – nie nur über ausgeblendete UI.
- **Reine Logik** (URL-Validierung, Suchnormalisierung, Parameter-Parsing, Übersetzungs-Fallback) liegt in `src/lib` ohne Framework-Abhängigkeiten und ist mit Unit-Tests abgedeckt.

## Entscheidungen

### ORM: Prisma 7 (statt Drizzle)

Prisma erlaubte den Start mit SQLite und den späteren Wechsel zu PostgreSQL durch Änderung von `provider` und Driver Adapter, ohne das Schema neu zu schreiben (Drizzle hätte getrennte `sqlite-core`/`pg-core`-Schemas). Das Schema verwendet weiterhin keine providerspezifischen Typen (`@db.*`). Prisma `latest` zeigte zum Zeitpunkt der Einrichtung auf einen Release Candidate (8.0.0-rc); verwendet wird die stabile **7.10.1**. Die Konfiguration liegt in `prisma7.config.ts` (der von Prisma 7.10 bevorzugte Dateiname).

### Datenbank: PostgreSQL

Gestartet wurde mit SQLite; am 17.10.2026 – noch ohne schützenswerte Daten – erfolgte der Umstieg auf PostgreSQL (lokal und auf dem Beta-Server). Die SQLite-Migrationen wurden dabei durch eine neue Initial-Migration ersetzt; Daten wurden nicht übernommen. Enums sind jetzt native PostgreSQL-Typen.

- Verbindung über `@prisma/adapter-pg` (Treiber `pg`, Verbindungspool pro Prozess). `src/lib/prisma-factory.ts` erzeugt den Client für App und CLI-Skripte.
- `contains` entspricht in PostgreSQL `LIKE` und unterscheidet Groß-/Kleinschreibung. Die Suchspalte, Benutzernamen und E-Mails sind kleingeschrieben gespeichert; für frei geschriebene Namen (Anzeigename, Name) wird `mode: "insensitive"` verwendet.
- Die Raw-SQL-Zähler in `/go/[linkId]` verwenden die von Prisma angelegten, quotierten Bezeichner (`"ExternalLink"`, `"clickCount"`).

### Rendering: Cache Components mit zwischengespeicherten Daten

`cacheComponents` und `partialPrefetching` sind aktiv. Öffentliche Lesefunktionen (`src/server/data/projects.ts`, `creators.ts`, `categories.ts`, `tags.ts`) sind mit `'use cache'` zwischengespeichert, mit `cacheLife` und Tags aus `src/server/public-cache.ts`:

| Tag | Daten | Invalidierung |
| --- | --- | --- |
| `public:lists` | Katalog, Suche, Startseiten-Listen, Creator-Verzeichnis, Sitemap, Zähler | `revalidateTag(…, "max")`: stale-while-revalidate, Besucher warten nicht |
| `public:project:<slug>` | Detailseite eines Projekts | `updateTag`: sofort, damit Creator/Admins ihre Änderung direkt sehen |
| `public:creator:<username>` | Creator-Profil und dessen Projekt-Detailseiten | `updateTag` |
| `public:taxonomy` | Kategorien, Tags und alle Detailseiten (Namen) | `updateTag` |

Lebensdauer: `minutes` für alles mit Aufrufzahlen (Klicks über `/go` invalidieren bewusst nicht), `hours` für Kategorien und Tags. Die Invalidierung erfolgt in den Server Actions (`projectsChanged`, `creatorChanged`, `taxonomyChanged`).

**Warum nicht ein einziger Tag mit `updateTag`?** Gemessen: Jede Änderung ließ dann alle Seiten und die App-Shell-Prefetches (pro Seitenaufruf rund zehn Links) blockierend neu rendern. Unter paralleler Last wurden Abläufe dadurch deutlich langsamer. Mit stale-while-revalidate für Listen erneuert der Server sie einmal im Hintergrund.

**Folgen:** Listen zeigen nach einer Änderung für eine Anfrage noch den alten Stand (z. B. ein gerade ausgeblendetes Projekt im Katalog; die Detailseite liefert dann schon 404). Änderungen direkt in der Datenbank (Seed, Prisma Studio, CLI) werden erst nach Ablauf der Lebensdauer oder nach einem Neustart sichtbar. Der Cache liegt im Arbeitsspeicher des Prozesses; bei mehreren Instanzen ist ein gemeinsamer [`cacheHandler`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers) nötig. `next build` rendert Seitenhüllen und die Sitemap mit Daten vor und braucht deshalb Zugriff auf die Datenbank. Direkt nach einem Deployment erneuert der Server die beim Build vorgerenderten Seiten im Hintergrund (einmalig höhere Last).

Session-abhängige Teile (Kontomenü, Dashboard, Admin) bleiben ungecacht hinter `<Suspense>`; `getCurrentUser()` ruft `connection()` auf, weil Better Auth die Session gegen die aktuelle Uhrzeit prüft.

### Echte 404-Statuscodes

Sobald eine Seite streamt, ist der Status 200 festgelegt; ein späteres `notFound()` zeigt nur noch die 404-Seite mit `noindex`. Der ursprünglich geplante Weg über `ensureStatic = "navigation"` scheidet aus: Er verlangt, dass die ganze Route statisch ist – auch der Header mit der Session und die Katalogfilter in den `searchParams`.

Stattdessen prüft der Proxy (`src/proxy.ts` → `src/server/route-existence.ts`) für `/[locale]/mods/[slug]`, `/[locale]/creators/[username]` und `/[locale]/legal/[page]` vor dem Rendern, ob der Eintrag öffentlich existiert (eindeutige Indizes, ungecacht). Fehlt er, schreibt der Proxy auf die Catch-all-Route um und setzt Status 404. Das gilt auch für Client-Navigationen: Die RSC-Anfrage erhält 404, Next lädt die Seite vollständig nach. Unbekannte Pfade ohne eigene Route trifft die Catch-all-Route ohnehin mit echtem 404. Die Seiten prüfen weiterhin selbst (`notFound()`), falls sich der Zustand zwischen Proxy und Rendern ändert.

### Internationalisierung: next-intl mit `next/root-params`

- Routen immer mit Präfix (`/de/…`, `/en/…`), damit jede Sprachversion eine eigene, indexierbare URL mit hreflang-Alternativen hat.
- Gäste erhalten die Sprache über `Accept-Language`; Fallback ist **Englisch** (internationales Publikum). Änderbar in `src/i18n/routing.ts`.
- Die Sprache wird über `next/root-params` gelesen (von next-intl empfohlen, `setRequestLocale` ist veraltet).
- An den Browser werden nur die Übersetzungs-Namespaces gesendet, die Client-Komponenten benötigen (`Report`, `Errors`).
- Inhalte: `ProjectTranslation`, `CategoryTranslation`, `TagTranslation` je Sprache (eindeutig pro Datensatz + Sprache). Fehlt eine Übersetzung, wird die Originalsprache (`Project.defaultLocale`) angezeigt – mit Hinweis und korrektem `lang`-Attribut.
- **Kategorie-Slugs sind sprachneutral** (`/en/mods/busse`), wie in der Routenplanung vorgegeben. Lokalisierte Slugs wären über next-intl `pathnames` nachrüstbar.

### Routing von `/mods/[slug]`

Kategorien und Projekte teilen sich `/mods/[slug]`. Kategorie-Slugs haben Vorrang. Beim Anlegen von Projekten wird geprüft, dass der Slug keinem Kategorie-Slug entspricht, und beim Anlegen von Kategorien, dass er keinem Projekt-Slug entspricht.

### Suche

Pro Übersetzung wird eine normalisierte, kleingeschriebene Suchspalte `searchText` gespeichert (Titel, Kurzbeschreibung, Beschreibung, Tag-Namen aller Sprachen). Suchbegriffe werden identisch normalisiert, SQL-Wildcards entfernt, auf 6 Begriffe begrenzt und per `contains` (UND-verknüpft) abgefragt. Vorteile: einfache, portable Abfragen, korrekte Groß-/Kleinschreibung bei Umlauten, keine Rohabfragen. **Pflicht beim Schreiben:** `searchText` muss bei jeder Änderung von Texten oder Tags über `buildSearchText()` neu berechnet werden.

Ausbaupfad: PostgreSQL `tsvector` mit GIN-Index für Relevanz oder `pg_trgm` für Teilstrings; die Filterstruktur (`buildCatalogWhere`) ist so angelegt, dass weitere Filter (Fahrzeugtyp, Verkehrsunternehmen, Sprache, Add-ons, Kompatibilität) als zusätzliche `AND`-Bedingungen ergänzt werden können.

### Externe Links

- Gespeichert als eigene Datensätze (`ExternalLink`) pro Version, mit Anbieter, Quellentyp, Status und Prüfzeitpunkt.
- `parseExternalUrl()` akzeptiert nur öffentliche `http(s)`-Ziele ohne Zugangsdaten und lehnt lokale/private Hosts ab. Eine spätere automatische Linkprüfung muss zusätzlich die **per DNS aufgelöste IP** prüfen (DNS-Rebinding) und darf Weiterleitungen nur nach erneuter Prüfung folgen.
- Downloads laufen über `/go/[linkId]`: Weiterleitung nur auf die gespeicherte URL (kein Open Redirect), `nofollow`, `noindex`, in robots.txt gesperrt. Gezählt werden **Aufrufe externer Seiten**, ausdrücklich keine Downloads. Das Zählen nutzt rohes, parametrisiertes SQL, damit `updatedAt` des Projekts unverändert bleibt.
- „Beliebt“ basiert ausschließlich auf diesen gemessenen Aufrufen; ohne Daten zeigt die Startseite einen Leerzustand.

### Authentifizierung: Better Auth (statt Auth.js)

Auth.js v5 ist seit Jahren im Beta-Stadium, die stabile v4 ist nicht für den App Router gebaut, und E-Mail/Passwort müsste dort selbst implementiert werden. Better Auth (1.7.10, fest angeheftet) bringt Passwort-Hashing (scrypt), E-Mail-Bestätigung, Passwort-Reset, Datenbank-Sessions, Rate-Limits sowie Plugins für Benutzernamen und Rollen/Sperren mit.

- **Konfiguration:** `src/lib/auth.ts`. Schema-Tabellen `User`, `Session`, `Account` (Passwort-Hash), `Verification`, `RateLimit` folgen dem Better-Auth-Schema; IDs vergibt die Datenbank (`generateId: false`).
- **E-Mail-Bestätigung ist Pflicht** (`requireEmailVerification`). Dadurch antwortet Better Auth bei bereits registrierter E-Mail mit einer synthetischen Erfolgsantwort (kein Ausspähen registrierter Adressen); die Mail wird ohne `await` versendet, damit auch die Antwortzeit nichts verrät. Nach der Bestätigung ist man angemeldet (`autoSignInAfterVerification`).
- **Bestätigung per Code** (Plugin `emailOTP`, nur Typ `email-verification`): 6 Ziffern, 15 Minuten gültig, höchstens 5 falsche Eingaben pro Code, in der Datenbank nur gehasht. Better Auth verschickt bei Registrierung und Anmeldung nichts mehr selbst (`sendOnSignUp`/`sendOnSignIn: false`); `registerAction` und `loginAction` fordern den Code über `auth.api.sendVerificationOTP` an und leiten auf `/confirm-email` weiter. Codes gehen nur an unbestätigte Konten, eine Registrierung mit vergebener Adresse verschickt also nichts. Erneut senden: höchstens einmal pro Minute und fünfmal pro Stunde je Adresse; ein neuer Code macht den alten ungültig. Die Adresse für die Code-Seite steht in einem httpOnly-Cookie (`src/server/pending-verification.ts`), nicht in der URL. Links (`/api/auth/verify-email`) gibt es nur noch für die E-Mail-Änderung; die Seite `/verify-email` bleibt für bereits verschickte Links.
- **Formulare nutzen Server Actions**, die `auth.api.*` direkt aufrufen (funktioniert ohne JavaScript, Fehler werden lokalisiert). Wichtig: Direkte API-Aufrufe umgehen Rate-Limit und Origin-Prüfung des Better-Auth-Routers. Deshalb hat jede Auth-Action ein eigenes, datenbankgestütztes Rate-Limit (IP **und** Konto/E-Mail); CSRF-Schutz übernimmt Next.js für Server Actions. Die HTTP-Endpunkte unter `/api/auth/*` (u. a. für Links aus E-Mails) haben zusätzlich das Better-Auth-Rate-Limit (Speicher: Datenbank, auch lokal aktiv).
- **Sessions:** 30 Tage, täglich verlängert, in der Datenbank (sofort widerrufbar). Kein Cookie-Cache, damit Sperren und Rollenänderungen sofort greifen. `getCurrentUser()` liest die Session mit dem aktuellen Cookie-Stand (`cookies()`), damit nach einer Action mit neuer Session (z. B. Passwortwechsel) nicht kurzzeitig ein abgemeldeter Zustand gerendert wird.
- **Über HTTP gesperrte Endpunkte** (`disabledPaths`): `/change-email`, `/update-user`, `/list-sessions`, `/send-verification-email` und alle Endpunkte des `emailOTP`-Plugins (damit gibt es auch keine Anmeldung oder Passwort-Reset per Code). Sie werden nur aus Server Actions über `auth.api.*` aufgerufen, wo Passwortabfrage, Validierung und eigene Limits gelten. `/list-sessions` würde die Session-Tokens aller Geräte an den Browser liefern. `deleteUser` ist nicht aktiviert.
- **E-Mail ändern** (`changeEmailAction`): Passwort per `auth.api.verifyPassword` prüfen, dann `auth.api.changeEmail`. Better Auth schickt zuerst einen Link an die bisherige Adresse (`sendChangeEmailConfirmation`), danach an die neue (`sendVerificationEmail`; Kontext erkennbar an `emailVerified: true`). Erst der zweite Link übernimmt die Adresse. Ist die neue Adresse vergeben, ist die Antwort gleich, verschickt wird nichts.
- **Angemeldete Geräte:** `getOwnSessions()` liest die Session-Tabelle (ohne Tokens), Browser und System grob aus dem User-Agent (`src/lib/user-agent.ts`). Abmelden löscht die Zeile direkt; ohne Cookie-Cache ist die Sitzung damit sofort ungültig. Die aktuelle Sitzung endet nur über „Abmelden“.
- **Konto löschen** (`deleteAccountAction` → `src/server/account-deletion.ts`): Passwort und eingetippter Benutzername. In einer Transaktion werden eigene Projekte (Relation `Restrict`), Passwort-Links und der User gelöscht (Sessions, Accounts und Creator-Profil per Cascade, Meldungen und Mitwirkenden-Einträge per SetNull), danach die Bilddateien, und Caches werden invalidiert. Protokoll `user.self_delete` ohne Akteur. Admins sind ausgenommen (`canDeleteOwnAccount`).
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
