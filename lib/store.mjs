import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { botSiteCommands, botSiteFaqs, botSiteSettings } from "./bot-site-content.mjs";

const tableNames = new Set(["features", "commands", "faqs", "contacts"]);
const initialSettings = {
  ...botSiteSettings,
  logo_url: "",
  favicon_url: "/assets/favicon.svg",
  bot_number: "",
  support_number: "",
  bot_status: "Belum dikonfigurasi",
  github_url: "",
  social_url: "",
  og_image: "",
  copyright: "",
  default_theme: "light",
  nav_home_label: "Beranda",
  nav_home_url: "#home",
  nav_commands_label: "Perintah",
  nav_commands_url: "#commands",
  nav_contact_label: "Kontak",
  nav_contact_url: "#contact",
  color_primary: "#B47AFF",
  color_accent: "#43C6F5",
  color_background: "#F0E5FF",
  color_text: "#101010",
  color_card: "#E5D0FF",
  color_border: "#101010",
};

const defaultCommands = botSiteCommands;
const defaultFaqs = botSiteFaqs;

const legacyTranslations = {
  settings: {
    hero_title: { "Your WhatsApp, Smarter.": initialSettings.hero_title },
    hero_description: { "One bot, endless possibilities. Automate tasks, explore powerful commands, and make your WhatsApp experience more productive.": initialSettings.hero_description },
    site_description: { "A helpful WhatsApp bot, with its features and availability configured by its team.": initialSettings.site_description },
    bot_status: {
      "Not configured": initialSettings.bot_status,
      "Last known online": "Terakhir diketahui online",
      "Last known offline": "Terakhir diketahui offline",
    },
    seo_title: { "Chibot — Your WhatsApp, Smarter": initialSettings.seo_title },
    seo_description: { "Discover the WhatsApp bot, browse its available commands, and find setup information.": initialSettings.seo_description },
    nav_home_label: { Home: initialSettings.nav_home_label },
    nav_commands_label: { Commands: initialSettings.nav_commands_label },
    nav_contact_label: { Contact: initialSettings.nav_contact_label },
  },
  features: {
    title: {
      "Smart Commands": "Perintah Pintar", "AI Assistant": "Asisten AI",
      "Image & Media Tools": "Alat Gambar & Media", Downloader: "Pengunduh Media",
      "Group Utilities": "Fitur Grup", "Sticker Maker": "Pembuat Stiker",
      Automation: "Otomatisasi", "Fast Response": "Respons Cepat",
    },
    description: {
      "A growing collection of useful commands, documented here as they become available.": "Kumpulan perintah praktis yang terus bertambah dan dicatat saat tersedia.",
      "An assistant experience, when enabled and configured by the bot operator.": "Fitur asisten yang dapat digunakan jika sudah diaktifkan dan dikonfigurasi.",
      "Handy media utilities, subject to the bot's supported features.": "Beragam alat media sesuai fitur yang didukung bot.",
      "Media downloads where supported and permitted by the source.": "Unduh media jika didukung dan diizinkan oleh sumbernya.",
      "Tools for group conversations, with the required permissions.": "Alat untuk percakapan grup dengan izin yang diperlukan.",
      "Turn supported media into stickers, when available.": "Ubah media yang didukung menjadi stiker jika fitur tersedia.",
      "Reduce repetitive steps with bot-supported automations.": "Kurangi pekerjaan berulang dengan otomatisasi yang didukung bot.",
      "A clean interface for checking bot availability and commands.": "Cara praktis untuk melihat ketersediaan bot dan daftar perintah.",
    },
  },
  commands: {
    description: {
      "Show the available command list.": "Tampilkan daftar perintah yang tersedia.",
      "Check for a response from the bot, if supported.": "Periksa respons bot jika perintah ini didukung.",
      "Create a sticker from supported media, if enabled.": "Buat stiker dari media yang didukung jika fitur aktif.",
      "Use the AI feature if it has been configured.": "Gunakan fitur AI jika sudah dikonfigurasi.",
      "Show usage help, if supported by the bot.": "Tampilkan panduan penggunaan jika didukung bot.",
    },
    category: { General: "Umum" },
    usage_example: {
      ".sticker (reply to an image)": ".sticker (balas gambar)",
      ".ai What can you do?": ".ai Apa saja kemampuanmu?",
    },
  },
  faqs: {
    question: {
      "How do I use the bot?": "Bagaimana cara menggunakan bot?",
      "Is the bot free?": "Apakah bot ini gratis?",
      "Why is the bot not responding?": "Mengapa bot tidak merespons?",
      "Is my data safe?": "Apakah data saya aman?",
      "How do I report a bug?": "Bagaimana cara melaporkan bug?",
    },
    answer: {
      "Open WhatsApp and start a chat using the configured bot number. Browse the command list for examples.": "Buka WhatsApp dan mulai percakapan melalui nomor bot yang tertera. Lihat daftar perintah untuk contoh penggunaan.",
      "Availability and any usage limits are determined by the bot operator. Please check with the support contact.": "Ketersediaan dan batas penggunaan ditentukan oleh pengelola bot. Silakan hubungi kontak dukungan untuk informasi lebih lanjut.",
      "The bot may be unavailable or its number may not have been configured. Check the status shown here or contact support.": "Bot mungkin sedang tidak tersedia atau nomornya belum dikonfigurasi. Periksa status yang tertera atau hubungi dukungan.",
      "Only share information you are comfortable sending through WhatsApp. Contact the operator for details about their data practices.": "Kirim hanya informasi yang nyaman Anda bagikan melalui WhatsApp. Hubungi pengelola untuk mengetahui kebijakan data.",
      "Reach the support contact listed on this page and include steps to reproduce the issue.": "Hubungi kontak dukungan yang tercantum di halaman ini dan sertakan langkah untuk mengulang masalahnya.",
    },
  },
};

let publicClient;
let adminClient;
const requireClients = () => {
  if (!publicClient || !adminClient) throw new Error("Supabase is not initialized.");
};
const resultOrThrow = ({ data, error }, operation) => {
  if (error) {
    throw Object.assign(new Error(`Supabase ${operation} failed: ${error.message}`), {
      code: error.code,
    });
  }
  return data;
};
const safeTable = (table) => {
  if (!tableNames.has(table)) throw new Error(`Unsupported content table: ${table}`);
  return table;
};

export async function init() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required. Configure them in .env or the hosting environment.");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for protected server-side admin writes. Never expose it to the browser.");
  }

  publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  resultOrThrow(await publicClient.from("site_settings").select("key").limit(1), "connection check");
  const { data: settingsRows, error: settingsError } = await adminClient.from("site_settings")
    .upsert(Object.entries(initialSettings).map(([key, value]) => ({ key, value })), {
      onConflict: "key",
      ignoreDuplicates: true,
    }).select("key");
  if (settingsError) throw new Error(`Supabase settings initialization failed: ${settingsError.message}`);
  void settingsRows;

  await seedTable("commands", defaultCommands);
  await seedTable("faqs", defaultFaqs);
  await translateUnmodifiedStarterContent();
}

async function translateUnmodifiedStarterContent() {
  const { data: settingRows, error: settingsError } = await adminClient.from("site_settings").select("key,value");
  if (settingsError) throw new Error(`Supabase language update failed: ${settingsError.message}`);
  for (const row of settingRows || []) {
    const translated = legacyTranslations.settings[row.key]?.[row.value];
    if (translated) {
      resultOrThrow(await adminClient.from("site_settings").update({ value: translated }).eq("key", row.key), "language update");
    }
  }
  for (const [table, fields] of Object.entries({
    features: ["title", "description"],
    commands: ["description", "category", "usage_example"],
    faqs: ["question", "answer"],
  })) {
    const { data: rows, error } = await adminClient.from(table).select(`id,${fields.join(",")}`);
    if (error) throw new Error(`Supabase ${table} language update failed: ${error.message}`);
    for (const row of rows || []) {
      const values = {};
      for (const field of fields) {
        const translated = legacyTranslations[table][field]?.[row[field]];
        if (translated) values[field] = translated;
      }
      if (Object.keys(values).length) {
        resultOrThrow(await adminClient.from(table).update(values).eq("id", row.id), `${table} language update`);
      }
    }
  }
}

async function seedTable(table, defaults) {
  const { data, error } = await adminClient.from(table).select("id").limit(1);
  if (error) throw new Error(`Supabase ${table} initialization failed: ${error.message}`);
  if (data.length === 0) {
    resultOrThrow(await adminClient.from(table).insert(defaults), `${table} seed`);
  }
}

export async function settings() {
  requireClients();
  const rows = resultOrThrow(await publicClient.from("site_settings").select("key,value"), "settings read") || [];
  return { ...initialSettings, ...Object.fromEntries(rows.map(({ key, value }) => [key, value])) };
}

export async function saveSettings(values) {
  requireClients();
  const entries = Object.entries(values).map(([key, value]) => ({ key, value }));
  resultOrThrow(await adminClient.from("site_settings").upsert(entries, { onConflict: "key" }), "settings save");
}

export async function getSession(id) {
  requireClients();
  const { data, error } = await adminClient.from("admin_sessions")
    .select("id,admin_id,csrf_token,expires_at,admins(username)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(`Supabase session lookup failed: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    admin_id: data.admin_id,
    csrf_token: data.csrf_token,
    expires_at: Number(data.expires_at),
    username: data.admins?.username || null,
  };
}

export async function deleteSession(id) {
  requireClients();
  resultOrThrow(await adminClient.from("admin_sessions").delete().eq("id", id), "session delete");
}

export async function createSession(id, adminId, csrfToken, expiresAt) {
  requireClients();
  resultOrThrow(await adminClient.from("admin_sessions").insert({
    id, admin_id: adminId, csrf_token: csrfToken, expires_at: expiresAt,
  }), "session create");
}

export async function createAnonymousSession(id, csrfToken, expiresAt) {
  requireClients();
  resultOrThrow(await adminClient.from("admin_sessions").insert({
    id, admin_id: null, csrf_token: csrfToken, expires_at: expiresAt,
  }), "login session create");
}

export async function auditInsert(adminId, action) {
  requireClients();
  resultOrThrow(await adminClient.from("audit_log").insert({ admin_id: adminId, action }), "audit insert");
}

export async function getAdminByUsername(username) {
  requireClients();
  const { data, error } = await adminClient.from("admins").select("*").eq("username", username).maybeSingle();
  if (error) throw new Error(`Supabase admin lookup failed: ${error.message}`);
  return data;
}

export async function getAdminById(id) {
  requireClients();
  const { data, error } = await adminClient.from("admins").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Supabase admin lookup failed: ${error.message}`);
  return data;
}

export async function updateAdmin(id, values) {
  requireClients();
  const { data, error } = await adminClient.from("admins").update(values).eq("id", id).select("id").maybeSingle();
  if (error) {
    throw Object.assign(new Error(`Supabase admin update failed: ${error.message}`), {
      code: error.code,
    });
  }
  return data !== null;
}

export async function insertAdmin(admin) {
  requireClients();
  resultOrThrow(await adminClient.from("admins").insert(admin), "admin create");
}

export async function visibleRows(table) {
  requireClients();
  const { data, error } = await publicClient.from(safeTable(table)).select("*")
    .eq("is_visible", true).order("sort_order", { ascending: true }).order("id", { ascending: true });
  if (error) throw new Error(`Supabase ${table} read failed: ${error.message}`);
  return data || [];
}

export async function contactRows() {
  return visibleRows("contacts");
}

export async function resourceList(table, query) {
  requireClients();
  const { data, error } = await adminClient.from(safeTable(table)).select("*")
    .order("sort_order", { ascending: true }).order("id", { ascending: true });
  if (error) throw new Error(`Supabase ${table} list failed: ${error.message}`);
  const rows = data || [];
  if (!query) return rows;
  const needle = query.toLocaleLowerCase();
  return rows.filter((row) => Object.entries(row).some(([key, value]) =>
    key !== "id" && key !== "updated_at" && String(value ?? "").toLocaleLowerCase().includes(needle)));
}

async function normalizeResourceOrder(table) {
  const safeName = safeTable(table);
  const { data, error } = await adminClient.from(safeName).select("id,sort_order")
    .order("sort_order", { ascending: true }).order("id", { ascending: true });
  if (error) throw new Error(`Supabase ${safeName} order read failed: ${error.message}`);
  const rows = data || [];
  await Promise.all(rows.map(async (row, index) => {
    const nextOrder = index + 1;
    if (row.sort_order === nextOrder) return;
    resultOrThrow(
      await adminClient.from(safeName).update({ sort_order: nextOrder }).eq("id", row.id),
      `${safeName} order update`,
    );
  }));
  return rows.length;
}

export async function resourceGet(table, id) {
  requireClients();
  const { data, error } = await adminClient.from(safeTable(table)).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Supabase ${table} lookup failed: ${error.message}`);
  return data;
}

export async function resourceCreate(table, row) {
  requireClients();
  row.sort_order = (await normalizeResourceOrder(table)) + 1;
  resultOrThrow(await adminClient.from(safeTable(table)).insert(row), `${table} create`);
}

export async function resourceUpdate(table, id, values) {
  requireClients();
  const { data, error } = await adminClient.from(safeTable(table)).update(values).eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(`Supabase ${table} update failed: ${error.message}`);
  return data !== null;
}

export async function resourceDelete(table, id) {
  requireClients();
  const { data, error } = await adminClient.from(safeTable(table)).delete().eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(`Supabase ${table} delete failed: ${error.message}`);
  if (data !== null) await normalizeResourceOrder(table);
  return data !== null;
}

export async function counts() {
  requireClients();
  const entries = await Promise.all([...tableNames].map(async (table) => {
    const { count, error } = await adminClient.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`Supabase ${table} count failed: ${error.message}`);
    return [table, count || 0];
  }));
  return Object.fromEntries(entries);
}

export async function recentAudit(limit = 6) {
  requireClients();
  const { data, error } = await adminClient.from("audit_log").select("action,created_at")
    .order("id", { ascending: false }).limit(limit);
  if (error) throw new Error(`Supabase audit log read failed: ${error.message}`);
  return data || [];
}
