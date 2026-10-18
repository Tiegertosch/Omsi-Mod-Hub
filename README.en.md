<p align="center">
  <a href="README.md">🇩🇪 Deutsch</a> · <a href="README.en.md">🇬🇧 English</a>
</p>

<p align="center">
  <img src="docs/images/made-with-ai.png" alt="Made with AI – this project was built with AI" width="400">
</p>

# OMSI Mod Hub

International catalogue and download portal for mods for the bus simulator **OMSI 2** (working title).

Players find mods, see requirements, versions and compatibility, and get to the creator's original source. The portal **does not host any mod archives itself** – downloads always point to external sites that are clearly marked as such.

> **Status:** Closed beta. The public area, user accounts, creator dashboard and admin area (approvals, hiding, reports, bans, categories/tags, audit log) are implemented. What is still missing is listed in [docs/PROJEKTSTAND.md](docs/PROJEKTSTAND.md#offene-punkte) (German).
>
> OMSI is a trademark of its respective owners. OMSI Mod Hub is a community project and not an official offering of the developers or publishers.

The detailed documentation under `docs/` (architecture, deployment, project status) is currently only available in German.

## Features (current state)

| Area | Status |
| --- | --- |
| Home page with categories, new, updated and popular projects, creators | ✅ from the database |
| Mod catalogue `/mods` and categories `/mods/busse`, `/mods/karten`, … | ✅ |
| Server-side search, tag filters (AND), sorting, pagination, shareable URLs | ✅ |
| Project detail page with versions, changelog, installation, requirements, licence, contributors | ✅ |
| Requirements & add-ons as a list: name, optional link, freeware ("Download") or payware ("Buy now") | ✅ |
| External download links with labelling, click counting via `/go/[id]` | ✅ |
| Report function (Server Action, rate limit, honeypot) | ✅ handled under `/admin/reports` |
| Creator directory and profiles | ✅ |
| German/English: language-specific routes, metadata, fallback for project texts | ✅ |
| SEO: titles, descriptions, canonical, hreflang, Open Graph, sitemap, robots.txt | ✅ |
| Caching of public data (`use cache` with tags), real HTTP 404 for unknown projects, categories, creators and pages | ✅ |
| Two-step registration with progress indicator: account details, then a 6-digit code from the email (one box per digit, resend, correct the address), login (email or username), logout | ✅ Better Auth |
| Forgot / reset password via email link | ✅ |
| Dashboard and settings (display name, preferred language, change password) | ✅ |
| Account: change email address (confirmed via old and new address), list and sign out signed-in devices, delete account including all projects | ✅ |
| Roles `user` / `creator` / `admin`, checked server-side; admin overview (key figures, reports, new accounts) | ✅ |
| Become a creator (creator profile), project list, tabbed editor: DE/EN texts with formatting, category, tags, licence, add-ons, contributors, images, downloads | ✅ |
| Cover image and screenshots: secure upload (signature check, ≤ 5 MB, re-encoded to WebP without metadata); shown together in a carousel on the project page (swipe, arrows, thumbnails), preview cards show only the cover | ✅ |
| Versions with changelog and several external download links | ✅ |
| Status: draft → submit → approval/rejection (with reason), withdraw, archive; preview | ✅ |
| Admin: approval queue and hiding/unhiding published projects (with reason) `/admin/projects` | ✅ |
| Admin: handle reports (open → in progress → resolved/dismissed, internal note) `/admin/reports` | ✅ |
| Admin: search accounts and ban them temporarily/permanently (ends sessions, optionally hides projects) `/admin/users` | ✅ |
| Admin: create, edit, delete categories and tags `/admin/categories`, `/admin/tags`; audit log `/admin/audit` | ✅ |
| Emails to creators on approval, rejection, hiding and unhiding | ✅ |
| Legal pages: imprint, privacy policy, versioned terms of use with consent to new versions | ✅ terms still marked as draft |

## Technology

- **Next.js 16.4** (App Router, Cache Components, Turbopack), **React 19.3**, **TypeScript** (strict)
- **Tailwind CSS 4** with custom design tokens, icons from **lucide-react**
- **Prisma 7.10** with **PostgreSQL** (driver adapter `@prisma/adapter-pg`)
- **Better Auth 1.7** (email/password, plugins `username` and `admin`), **nodemailer** for emails
- **next-intl 4** for internationalisation
- **Zod 4** for validation
- **Vitest 5** (unit) and **Playwright 1.64** (end-to-end)
- Package manager **pnpm 12**

Rationale and architecture decisions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (German).

## Requirements

- Node.js **≥ 20.19** (tested with 24.22)
- pnpm **12** (`npm install -g pnpm`)
- **PostgreSQL** (tested with 18; on Windows via the official installer)

## Installation

Create a role and a database once (asks for the password of the `postgres` user; Prisma needs `CREATEDB` locally for a shadow database when generating migrations):

```bash
psql -U postgres -h localhost \
  -c "CREATE ROLE omsi_mod_hub LOGIN CREATEDB PASSWORD 'YOUR-OWN-PASSWORD';" \
  -c "CREATE DATABASE omsi_mod_hub OWNER omsi_mod_hub;"
```

On Windows, `psql` is located at `C:\Program Files\PostgreSQL\<version>\bin\psql.exe`.

```bash
pnpm install          # installs dependencies and generates the Prisma client
cp .env.example .env  # Windows PowerShell: Copy-Item .env.example .env
                      # → set DATABASE_URL (password) and BETTER_AUTH_SECRET
pnpm db:migrate       # applies the migrations
pnpm db:seed          # categories, tags and clearly marked sample data
pnpm dev              # http://localhost:3000
```

pnpm 12 only runs build scripts of dependencies after approval. The required approvals (`prisma`, `@prisma/engines`, `esbuild`) are already listed in `pnpm-workspace.yaml`; `better-sqlite3` only comes in indirectly via Prisma Studio and is not built.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection, e.g. `postgresql://omsi_mod_hub:PASSWORD@localhost:5432/omsi_mod_hub`. |
| `NEXT_PUBLIC_SITE_URL` | recommended | Public base URL without a trailing slash; used for canonical URLs, sitemap and Open Graph. Default: `http://localhost:3000`. |
| `BETTER_AUTH_SECRET` | yes | Random secret (≥ 32 characters) for signing sessions and tokens. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `BETTER_AUTH_URL` | yes | Public URL of the app. Links in emails point there; it must match the address being used. |
| `MAIL_TRANSPORT` | yes in production | `file` (development: emails as JSON in `./.dev-mail`), `console` (development) or `smtp`. Without a value, `file` applies locally; in production, sending then fails. |
| `SMTP_URL`, `MAIL_FROM` | with `smtp` | e.g. `smtps://user:pass@smtp.example.com:465` and `OMSI Mod Hub <no-reply@example.com>` |
| `PROJECT_REVIEW_REQUIRED` | no | `true` (default): submissions need admin approval. `false`: submitting publishes directly. |
| `UPLOAD_DIR` | no | Storage for uploaded images, default `./storage/uploads` (not in `public/`, served via `/media/…`). |

Template: [.env.example](.env.example). Real credentials never belong in the repository.

## Accounts and roles

- **Registration** requires a confirmed email address before signing in is possible. After registering, `/confirm-email` opens for the 6-digit code; anyone signing in while unconfirmed lands there too and receives a new code. Locally, the code is in the subject of the newest file in `.dev-mail/`.
- **Roles:** `user` (default), `creator`, `admin`. Roles can be changed neither during registration nor via the API – only server-side.
- **First admin account:** register and confirm an account as usual, then run locally on the server:
  ```bash
  pnpm user:set-role your@address.example admin
  ```
  The change is recorded in the audit log. There is intentionally no web route and no seed for this.
- **Creators:** Every confirmed account can create a creator profile under *Dashboard → My projects* and thereby gets the `creator` role (logged). Projects go through: draft → *Submit for review* (checklist: texts in the original language, category, licence, at least one version with a link) → approval or rejection with a reason under `/admin/projects`. Published projects remain editable; changes are public immediately. The URL slug is fixed after the first publication.
- **Protected areas:** `/dashboard` (signed in) and `/admin` (role `admin`; others get a 404). Checks happen server-side in every page and every Server Action; without a session cookie, the proxy only redirects to the login in advance.

## Database

| Command | Purpose |
| --- | --- |
| `pnpm db:migrate` | Create and apply a migration from schema changes (development) |
| `pnpm db:deploy` | Apply existing migrations (production/CI) |
| `pnpm db:seed` | Create or update categories and tags; regenerate sample data |
| `SEED_SAMPLES=false pnpm db:seed` | Base data only, no sample data |
| `pnpm db:clear-samples` | Remove all sample data (`isSample = true`) |
| `pnpm db:reset` | Reset the database, re-run all migrations and the seed (**deletes all data**) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm user:set-role <email> <user\|creator\|admin>` | Set the role of a confirmed account (local CLI, with audit log) |
| `pnpm mail:test <email>` | Check the SMTP configuration and send a test email |

**Sample data:** All creators and projects from the seed are fictional, marked with `isSample = true`, labelled as "Sample data" in the interface, excluded from search engines via `noindex` and only link to `example.com`. The illustrations under `public/samples/` were made specifically for this project. The seed creates **no admin accounts and no passwords**.

**Backups:** `pg_dump --format=custom "postgresql://…"`; on the server, `deploy/backup.sh` takes care of this (see docs/DEPLOYMENT.md).

## Development, tests and build

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm typecheck` | Generate route types and check TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm check` | typecheck + lint + test |
| `pnpm build` / `pnpm start` | Production build / server |
| `pnpm test:e2e` | Playwright tests against the production build (run `pnpm build` first, database seeded) |

Install the browser for the E2E tests once: `pnpm exec playwright install chromium`. The tests start their own server on port 3000 (it must match `BETTER_AUTH_URL`; an already running server, e.g. `pnpm dev`, is not reused – the run aborts instead). The test server writes emails to its own folder `.e2e-mail/`; `.dev-mail/` stays untouched. If `pnpm dev` is currently running on port 3000, use a different port: `E2E_PORT=3001 BETTER_AUTH_URL=http://localhost:3001 pnpm test:e2e`. Test accounts (`@e2e.example.com`) together with their projects, reports, audit entries and test emails, as well as test categories/tags (`e2e-…`), are removed automatically afterwards; the report test on the public page files a report on a sample project, and `pnpm db:seed` resets the sample data.

## Operations / deployment

The first beta runs on its own Linux server (Node.js with systemd, Caddy as HTTPS reverse proxy with basic auth, PostgreSQL on the same server, images on disk). The step-by-step guide is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (German), the related files under [deploy/](deploy/):

- `deploy.sh`: deployment with release folders, health check and automatic rollback
- `backup.sh`: daily backup of database and images
- systemd units, `Caddyfile.example`, `env.production.example`

`GET /api/health` reports whether the app and the database are reachable; the endpoint is intended for monitoring.

## Project structure

```
messages/              UI texts (de.json, en.json)
prisma/                schema, migrations, seed
public/samples/        own illustrations for sample data
src/
  app/
    [locale]/          localised pages (home, mods, creators, search, legal,
                       login, register, confirm-email, forgot-/reset-password, verify-email, dashboard, admin)
    api/auth/[...all]/ Better Auth endpoints
    go/[linkId]/       redirect to external downloads (counts clicks)
    sitemap.ts, robots.ts, icon.svg
  components/
    layout/            header, footer, navigation, language switch, search
    mods/              project cards, catalogue, detail view, download links, report form
    creators/          creator cards
    auth/, account/    sign-in forms, account menu, settings forms
    editor/, creator/  project editor (data, media, versions, status), creator profile
    admin/             navigation, moderation, reports, bans, category/tag forms
    ui/                base components (button, badge, form fields, empty/loading/notice states)
  i18n/                next-intl: routing, navigation, request configuration
  lib/                 auth.ts (Better Auth configuration) and pure helper functions
  server/
    session.ts         data access layer: current user, requireUser/requireAdmin
    data/              database queries (server-side only)
    actions/           Server Actions (sign-in, account, projects, moderation, reports, accounts, categories/tags)
    admin-action.ts    shared checks for admin actions (role, rate limit)
    emails.ts          localised email texts (verification code, password, email change, moderation decisions)
    mail.ts            email delivery (file/console/smtp)
    images.ts, storage.ts  image validation/re-encoding (sharp) and storage
  app/media/[key]/     serving uploaded images
  proxy.ts             language detection, early redirect for protected areas
scripts/               set-role.ts (roles via CLI), send-test-mail.ts (SMTP test), cleanup-e2e.ts
deploy/                server configuration and scripts (see docs/DEPLOYMENT.md)
tests/
  unit/                Vitest
  e2e/                 Playwright
```

## Known limitations

- **Moderation:** Admin rights are intentionally granted and revoked via CLI only; admins cannot be banned. A ban only hides projects on request, and lifting a ban does not automatically show them again. Categories can only be managed on one level (no parent category selectable); slugs of categories and tags are fixed once created. Banned users only see "This account has been suspended." when signing in, not the reason. The audit log shows the last 100 entries without filters.
- **Notifications** are sent in the background without a queue; if sending fails, this is only logged (no retry). Nothing is sent to sample accounts.
- **Local image storage:** Uploads are stored on the file system (`UPLOAD_DIR`). Multiple server instances or serverless hosting require object storage (e.g. S3); the interface is encapsulated in `src/server/storage.ts`. Backups must include this directory.
- **Screenshot order** cannot be changed yet (upload order); image descriptions can only be set when uploading.
- **SMTP delivery:** The E2E tests use `MAIL_TRANSPORT=file`. `pnpm mail:test <address>` checks the SMTP access (in use with a real SMTP provider on the beta).
- **IP-based rate limits** read `X-Forwarded-For`. This is only reliable behind a reverse proxy that sets or overwrites this header; exposed directly to the internet, the IP limit could be bypassed. Limits per account/email remain effective.
- **Usernames** cannot be changed after registration (part of the profile URL). Admins cannot delete their own account; the role is revoked via CLI first. Deleting an account creates `user.self_delete` audit entries without an actor; the E2E cleanup script (`scripts/cleanup-e2e.ts`) intentionally does not remove them because they cannot be distinguished from real ones.
- **Caching:** Public data is cached (details in ARCHITECTURE.md). After a change, lists and the catalogue still show the old state for one request; click counters can be up to a few minutes old. Changes made directly in the database (seed, Prisma Studio, CLI) only appear after the cache lifetime expires or after a restart. The cache lives in memory – multiple server instances need a shared cache handler. `pnpm build` needs access to the database.
- **404 check in the proxy:** For project, category, creator and legal pages, the proxy queries the database via unique indexes on every request (including prefetches). With very high traffic, a short-lived cache for this would make sense.
- **Search:** Substring search over a normalised search column – sufficient for the MVP, but without relevance ranking and slow with many thousands of projects. Planned: PostgreSQL full-text search or `pg_trgm`.
- **Link clicks** are counted without bot detection beyond a user-agent heuristic and are therefore an approximation.
- **Dark mode only**; a light theme is not planned as long as there is no demand.
- **Legal texts:** The imprint contains the details from the imprint service (online-impressum.de). The privacy policy comes from the WBS Legal generator and is stored unchanged as `content/legal/privacy.de.md` (new version: replace the file; the English page shows the German text with a notice). The terms of use are versioned under `content/legal/terms/<version>.de.md` (binding) and `.en.md` (reading version); a new version is registered in `src/lib/legal.ts`, and signed-in users must then accept it via a popup or close their account. The terms have not been legally reviewed yet and are therefore marked as "draft" and not indexed. Registration from age 16 (confirmed via checkbox).
- A Content Security Policy is not set yet (other security headers are).

## Next steps

1. **Extend moderation:** move projects to another category, filter/paginate the audit log, set link status (`BROKEN`/`BLOCKED`) directly from reports.
2. **Notifications:** sending queue with retries, opt-out for notifications.
3. **Object storage** for uploads (S3-compatible) instead of the local file system.
4. **Link checking** in the background with DNS-based SSRF protection.
5. **Search and scaling:** PostgreSQL full-text search or `pg_trgm`, managed database with point-in-time recovery, shared cache handler for multiple instances.

## Contributing

Feedback, bug reports and suggestions are welcome – ideally as an issue. For larger changes, please open an issue first so we can agree on the direction. Before a pull request, run `pnpm check` and `pnpm build && pnpm test:e2e`.

Please do **not** report security vulnerabilities as a public issue; follow [SECURITY.md](SECURITY.md) instead.

## License

Copyright © 2026 SirTiegertosch

This project is licensed under the **GNU Affero General Public License v3.0** ([LICENSE](LICENSE)). Anyone who modifies the code and runs it as a website must make the modified source code available to its users under this licence as well.

Not covered by the licence are the legal texts under `content/legal/` (partly created with a generator) and the imprint details in `messages/*.json`: they relate to the operation of omsi-modhub.de and must not be reused for other sites.
