# Chibot website

A Vue 3 single-page app for the WhatsApp bot landing page and private content-management panel, backed by an Express API and Supabase Postgres. The site does not connect to a WhatsApp session or claim live bot status. Its starter content reflects the checked bot command handler; phone numbers and the operator-maintained status note remain configurable in the admin panel.

## Requirements

- Node.js 22 or newer and npm.
- A Supabase project and its project URL, anon key, and server-only service role key.
- A persistent writable directory for uploaded images.
- HTTPS in production.

## Install and run locally

```powershell
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Before starting, create a Supabase project, run `migrations/postgres_schema.sql` in its SQL editor, then fill in all three Supabase variables in `.env`. The development command starts the Express API and Vite frontend. Open `http://127.0.0.1:5173`.

Create the first administrator in a separate terminal:

```powershell
npm run admin:create
```

The first administrator is created interactively; there is no default account or public registration route. Choose a unique password of at least 12 characters.

## Sync website content with the bot script

The verified Chitanda Eru Bot starter profile, feature descriptions, commands, and FAQs are in `lib/bot-site-content.mjs`. They are based on the bot's configured identity, `events/message.js`, AI message handling, and the reminder/menfess modules. Owner-only commands and sample statistics are not advertised; group permissions, AI configuration, and the configured reminder-group restriction are called out in the copy.

After changing the website starter content, sync it to the existing Supabase project from the website project directory:

```powershell
npm run content:sync-bot
```

This uses `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`. It updates only rows/settings that still exactly match known, unmodified starter copy, adds missing starter entries, and leaves customized content, the configured bot/support numbers, and visibility settings untouched. Review the public page and edit any intentionally customized content in `/admin` afterward.

To run without copying the example file, set the variables in your shell or hosting provider. Environment values take precedence over `.env`.

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `NODE_ENV` | Use `production` to enable secure session cookies and HSTS | `development` |
| `PORT` | HTTP listener port | `3000` |
| `HOST` | Listener interface; set according to your hosting platform | `127.0.0.1` |
| `DATA_DIR` | Persistent directory for uploaded images | `./data` |
| `SUPABASE_URL` | Supabase project URL | |
| `SUPABASE_ANON_KEY` | Supabase anon key used for public read-only queries | |
| `SUPABASE_SERVICE_ROLE_KEY` | Private server-side key required for admin CRUD, sessions, and setup | |

Admin sessions and scrypt-hashed admin credentials are stored in Supabase. The application uses random opaque session identifiers, `HttpOnly`/`SameSite=Strict` cookies, per-form CSRF tokens, and expiring server-side sessions. The service role key bypasses RLS, so it must only be configured in the server environment. Never expose it to the browser or commit `.env`.

Find the project URL, anon key, and service role key in the Supabase dashboard under **Project Settings → API**. The service role key is a private server credential; do not send it in chat or include it in client-side code.

Read `migrations/README.md` for schema setup and optional migration from the old SQLite `data/website.sqlite`.

## Database and first administrator

The schema is created by running `migrations/postgres_schema.sql` once in Supabase. Starter settings/features/commands/FAQs are inserted only when their tables are empty. The example commands/features/FAQs are editable starter content, not evidence of bot capabilities. Remove or adapt them from `/admin` before publishing.

Create another administrator from a trusted terminal:

```powershell
npm run admin:create
```

The command prompts for a username and password and stores only a scrypt hash. There is no public account creation endpoint. Use Supabase's database backups or `pg_dump` and also back up the local `DATA_DIR/uploads` directory. Keep backups encrypted and access-controlled.

## Admin panel

- `/admin` — sign in.
- `/admin/dashboard` — actual content counts and recent admin audit entries.
- `/admin/settings` — brand, page copy, international WhatsApp numbers, manual status note, links, SEO and image URLs.
- `/admin/features`, `/admin/commands`, `/admin/faqs`, `/admin/contacts` — searchable create/read/update/delete, order and visibility.
- `/admin/appearance` — color settings, default theme and a live preview.
- `/admin/profile` — change username and password after verifying the current password.

The first configured bot number must include its country calling code. Chat links remove punctuation and pass only digits to `wa.me`. Leaving the number empty displays a setup placeholder instead of a fabricated number. “Last known online/offline” is an operator-maintained note and is not a live status check. Counts on the public page describe listed content only; user totals and uptime are not invented.

Image fields accept HTTPS/site-relative URLs or local uploads. Uploads are limited to 3 MB and verified as PNG, JPEG, WebP, or ICO by file signature. Uploaded assets live under `DATA_DIR/uploads`; back them up with the database.

## Production build and deployment

Build the Vue frontend into `public/`, then run the Node API and static-file server:

```powershell
npm run build
npm start
```

For Vercel:

1. Import the repository with the project root set to this directory and select the **Express** framework preset (not Vite). Vercel detects the root `server.mjs` Express app as a Node.js Function; `public/` contains the static assets.
2. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in **Settings → Environment Variables** for Production (and Preview if needed). Keep the service role key server-only.
3. Deploy and check `https://<your-domain>/api/site` for JSON, then `/admin` and `/nomor`. If changing environment variables, redeploy.
4. Vercel Functions have ephemeral filesystems. The admin image-upload endpoint writes to local disk and therefore is not supported on Vercel; use HTTPS-hosted images for now. Persisted uploads require integrating object storage or Supabase Storage.

For a VM, container, or other Node-capable platform:

1. Install dependencies with `npm ci` from the checked-in lockfile.
2. Set `NODE_ENV=production`, `PORT`, `HOST`, `DATA_DIR`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the platform environment.
3. Run `npm run build` during deployment so Vite writes the frontend to `dist/`.
4. Provision HTTPS at the platform ingress/reverse proxy. Terminate TLS there and forward requests to the Node listener. The production cookie is Secure and requires HTTPS.
5. Start the Node app with `npm start`, and verify the public page, `/admin`, Supabase persistence, and image uploads.
6. Run `npm run admin:create` securely on the host (or through a one-off deployment task) to establish the first admin account.
7. Point the domain's DNS records at the hosting provider and enable its managed TLS certificate. Configure redirects from HTTP to HTTPS at the proxy.

The database and session store are hosted in Supabase. Local uploads still require a persistent filesystem; for ephemeral or multi-instance hosts configure a shared object store or Supabase Storage before using the upload feature. Restrict access to hosting secrets and backups, rotate admin passwords, and test database restore procedures. This repository does not include a provider-specific deployment manifest because no hosting provider was specified.

## Bot integration and known boundaries

The website does not start a WhatsApp client or access the bot's session. The starter content is a curated snapshot of the bot source that was reviewed; it is not dynamically generated from the bot at runtime and should be synchronized/reviewed when bot commands change. Some capabilities depend on AI credentials, group context/permissions, or the configured reminder group. There is no public bot-status API, so the site does not claim live status or uptime and does not invent usage statistics. Keep phone numbers, links, contacts, and manually maintained status accurate through `/admin`.
"# chibot" 
