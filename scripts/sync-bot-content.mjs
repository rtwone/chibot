import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { botSiteCommands, botSiteFaqs, botSiteSettings } from "../lib/bot-site-content.mjs";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function dataOrThrow({ data, error }, operation) {
  if (error) throw new Error(`Supabase ${operation} failed: ${error.message}`);
  return data;
}

const legacySettings = {
  brand_name: "Chibot",
  hero_title: "WhatsApp-mu, Lebih Cerdas.",
  hero_description: "Satu bot, banyak kemungkinan. Otomatiskan tugas, jelajahi beragam perintah, dan gunakan WhatsApp dengan lebih produktif.",
  site_description: "Bot WhatsApp yang membantu, dengan fitur dan ketersediaan yang diatur oleh tim pengelola.",
  seo_title: "Chibot — WhatsApp-mu, Lebih Cerdas",
  seo_description: "Kenali bot WhatsApp, jelajahi perintah yang tersedia, dan temukan informasi penggunaannya.",
};

const previousBotSettings = {
  brand_name: "Chitanda Eru Bot",
  hero_title: "Kenalan dengan Chitanda Eru Bot.",
  hero_description: "Asisten WhatsApp dengan chatbot AI, pencarian dan pemutar YouTube, alat stiker, menfess, serta utilitas grup. Ketersediaan beberapa fitur mengikuti konfigurasi bot.",
  site_description: "Chitanda Eru Bot adalah bot WhatsApp berbasis Baileys dengan chatbot AI, alat YouTube dan stiker, menfess, serta utilitas grup dan pengingat untuk grup yang dikonfigurasi.",
  seo_title: "Chitanda Eru Bot — Asisten WhatsApp",
  seo_description: "Jelajahi kemampuan Chitanda Eru Bot: chatbot AI, pencarian dan pemutar YouTube, alat stiker, menfess, serta utilitas WhatsApp.",
};

const legacyCommands = [
  ["command-1", ".menu", "Tampilkan daftar perintah yang tersedia.", "Umum", ".menu"],
  ["command-2", ".ping", "Periksa respons bot jika perintah ini didukung.", "Umum", ".ping"],
  ["command-3", ".sticker", "Buat stiker dari media yang didukung jika fitur aktif.", "Media", ".sticker (balas gambar)"],
  ["command-4", ".ai", "Gunakan fitur AI jika sudah dikonfigurasi.", "AI", ".ai Apa saja kemampuanmu?"],
  ["command-5", ".help", "Tampilkan panduan penggunaan jika didukung bot.", "Umum", ".help"],
].map(([id, command, description, category, usage_example]) => ({
  id, command, description, category, usage_example,
}));

const legacyFaqs = [
  ["faq-1", "Bagaimana cara menggunakan bot?", "Buka WhatsApp dan mulai percakapan melalui nomor bot yang tertera. Lihat daftar perintah untuk contoh penggunaan."],
  ["faq-2", "Apakah bot ini gratis?", "Ketersediaan dan batas penggunaan ditentukan oleh pengelola bot. Silakan hubungi kontak dukungan untuk informasi lebih lanjut."],
  ["faq-3", "Mengapa bot tidak merespons?", "Bot mungkin sedang tidak tersedia atau nomornya belum dikonfigurasi. Periksa status yang tertera atau hubungi dukungan."],
  ["faq-4", "Apakah data saya aman?", "Kirim hanya informasi yang nyaman Anda bagikan melalui WhatsApp. Hubungi pengelola untuk mengetahui kebijakan data."],
  ["faq-5", "Bagaimana cara melaporkan bug?", "Hubungi kontak dukungan yang tercantum di halaman ini dan sertakan langkah untuk mengulang masalahnya."],
].map(([id, question, answer]) => ({ id, question, answer }));

async function syncSettings() {
  const rows = dataOrThrow(
    await client.from("site_settings").select("key,value"),
    "site settings read",
  ) || [];
  let updated = 0;
  for (const key of new Set([...Object.keys(legacySettings), ...Object.keys(previousBotSettings)])) {
    const row = rows.find((item) => item.key === key);
    const previousValues = [legacySettings[key], previousBotSettings[key]].filter(Boolean);
    if (!row || !previousValues.includes(row.value)) continue;
    const previousValue = row.value;
    dataOrThrow(
      await client.from("site_settings").update({ value: botSiteSettings[key] }).eq("key", key).eq("value", previousValue),
      `site setting update (${key})`,
    );
    updated += 1;
  }
  return updated;
}

async function syncTable(table, columns, legacyRows, currentRows, comparableFields, updateFields) {
  const rows = dataOrThrow(
    await client.from(table).select(columns),
    `${table} read`,
  ) || [];
  if (!rows.length) {
    dataOrThrow(await client.from(table).insert(currentRows), `${table} initial content insert`);
    return { updated: 0, inserted: currentRows.length };
  }

  let updated = 0;
  for (const previous of legacyRows) {
    const row = rows.find((item) => item.id === previous.id);
    const current = currentRows.find((item) => item.id === previous.id);
    if (!row || !current || !comparableFields.every((field) => row[field] === previous[field])) continue;
    dataOrThrow(
      await client.from(table).update(Object.fromEntries(updateFields.map((field) => [field, current[field]]))).eq("id", row.id),
      `${table} starter content update (${row.id})`,
    );
    updated += 1;
  }

  let inserted = 0;
  for (const current of currentRows) {
    if (rows.some((row) => row.id === current.id)) continue;
    if (table === "commands" && rows.some((row) => row.command.toLocaleLowerCase() === current.command.toLocaleLowerCase())) continue;
    dataOrThrow(await client.from(table).insert(current), `${table} content insert (${current.id})`);
    inserted += 1;
  }
  return { updated, inserted };
}

const settingsUpdated = await syncSettings();
const commands = await syncTable(
  "commands",
  "id,command,description,category,usage_example",
  legacyCommands,
  botSiteCommands,
  ["command", "description", "category", "usage_example"],
  ["command", "description", "category", "usage_example", "sort_order"],
);
const faqs = await syncTable(
  "faqs",
  "id,question,answer",
  legacyFaqs,
  botSiteFaqs,
  ["question", "answer"],
  ["question", "answer", "sort_order"],
);

console.log(`Konten bot tersinkronisasi: ${settingsUpdated} pengaturan, ${commands.updated} perintah diperbarui/${commands.inserted} ditambahkan, ${faqs.updated} FAQ diperbarui/${faqs.inserted} ditambahkan.`);
