import "dotenv/config";
import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env to migrate protected tables.");
  process.exit(2);
}
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });

const dataDir = process.env.DATA_DIR || "./data";
const dbPath = resolve(dataDir, "website.sqlite");
const db = new Database(dbPath, { readonly: true });

const copyTable = async (table, columns) => {
  const rows = db.prepare(`SELECT ${columns.join(",")} FROM ${table}`).all().map((row) => ({
    ...row,
    ...(Object.hasOwn(row, "is_visible") ? { is_visible: Boolean(row.is_visible) } : {}),
  }));
  if (!rows || !rows.length) {
    console.log(`No rows to copy for ${table}`);
    return;
  }
  console.log(`Migrating ${rows.length} rows into ${table}...`);
  const { data, error } = await supabase.from(table).upsert(rows, { onConflict: columns[0] });
  if (error) {
    throw new Error(`Migration failed for ${table}: ${error.message}`);
  } else {
    console.log(`Migrated ${data?.length ?? rows.length} rows into ${table}`);
  }
};

(async () => {
  try {
    console.log("Starting migration from SQLite to Supabase...");
    // site_settings is key/value
    const settings = db.prepare("SELECT key, value FROM site_settings").all();
    if (settings && settings.length) {
      const payload = settings.map((r) => ({ key: r.key, value: r.value }));
      const { error } = await supabase.from("site_settings").upsert(payload, { onConflict: "key" });
      if (error) throw new Error(`Migration failed for site_settings: ${error.message}`);
      else console.log(`Upserted ${payload.length} site_settings rows`);
    } else {
      console.log("No site_settings found to migrate.");
    }

    await copyTable("features", ["id", "title", "description", "icon", "sort_order", "is_visible", "updated_at"]);
    await copyTable("commands", ["id", "command", "description", "category", "usage_example", "sort_order", "is_visible", "updated_at"]);
    await copyTable("faqs", ["id", "question", "answer", "sort_order", "is_visible", "updated_at"]);
    await copyTable("contacts", ["id", "label", "type", "value", "url", "sort_order", "is_visible", "updated_at"]);

    // Existing hashed credentials can be carried over; live sessions are intentionally invalidated.
    const admins = db.prepare("SELECT id, username, password_hash, created_at FROM admins").all();
    if (admins && admins.length) {
      const { error } = await supabase.from("admins").upsert(admins, { onConflict: "id" });
      if (error) throw new Error(`Migration failed for admins: ${error.message}`);
      console.log(`Upserted ${admins.length} admins`);
    } else console.log("No admins to migrate.");

    const audit = db.prepare("SELECT id, admin_id, action, created_at FROM audit_log").all();
    if (audit && audit.length) {
      const { error } = await supabase.from("audit_log").upsert(audit, { onConflict: "id" });
      if (error) throw new Error(`Migration failed for audit_log: ${error.message}`);
      console.log(`Inserted ${audit.length} audit_log rows`);
    } else console.log("No audit_log to migrate.");

    console.log("Migration complete. Verify data in Supabase.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  }
})();
