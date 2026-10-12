Run the `postgres_schema.sql` file in the Supabase SQL editor before starting the application. It creates the site data, custom administrator/session tables, audit log, and row-level security policies.

Public access uses `SUPABASE_ANON_KEY` with read-only policies for settings and visible content. The server uses `SUPABASE_SERVICE_ROLE_KEY` for authenticated admin operations; this key bypasses RLS and must remain server-side.

If an earlier local SQLite database contains content to preserve:

1. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment.
2. Run `node scripts/migrate-to-supabase.mjs`.
3. Run this statement in Supabase SQL Editor to sync the audit log identity after importing explicit IDs:

   `SELECT setval(pg_get_serial_sequence('public.audit_log', 'id'), COALESCE((SELECT MAX(id) FROM public.audit_log), 1), EXISTS (SELECT 1 FROM public.audit_log));`

Existing admin password hashes are preserved; existing sessions are not copied and admins must sign in again.
