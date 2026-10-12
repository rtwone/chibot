import "dotenv/config";
import express from "express";
import multer from "multer";
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as store from "./lib/store.mjs";

await store.init();

const app = express();
const scrypt = promisify(scryptCallback);
const production = process.env.NODE_ENV === "production";
const sessionCookie = production ? "__Host-chibot_session" : "chibot_session";
const sessionLifetime = 12 * 60 * 60 * 1000;
const staticUploads = resolve(process.env.DATA_DIR || "./data", "uploads");
const staticDirectory = resolve("public");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1 } });
const loginAttempts = new Map();
const contentTables = new Set(["features", "commands", "faqs", "contacts"]);
const scryptCost = 64;
let whatsappProfileCache = { number: "", imageUrl: "", expiresAt: 0 };

const randomToken = (size = 32) => randomBytes(size).toString("hex");
const constantTimeEquals = (left = "", right = "") => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
};
const normaliseNumber = (value = "") => String(value).replace(/\D/g, "");
const safeUrl = (value = "") => {
  const url = String(value).trim();
  if (!url) return "";
  if (/^\/(?!\/)/.test(url)) return url;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
};
const safeNavigationUrl = (value = "") => /^#[\w-]+$/.test(String(value).trim()) || safeUrl(value);
const validWhatsAppNumber = (value) => {
  const digits = normaliseNumber(value);
  return digits.length >= 8 && digits.length <= 15;
};
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
})[character]);
const isPreviewCrawler = (userAgent = "") => /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Discordbot|LinkedInBot/i.test(userAgent);
const readLimitedText = async (response, limit) => {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("WhatsApp tidak mengirim isi halaman profil.");
  const chunks = [];
  let total = 0;
  while (total < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = value.subarray(0, limit - total);
    chunks.push(Buffer.from(chunk));
    total += chunk.byteLength;
    if (chunk.byteLength < value.byteLength) {
      await reader.cancel();
      break;
    }
  }
  if (total >= limit) await reader.cancel();
  return Buffer.concat(chunks, total).toString("utf8");
};
const whatsappProfileImage = async (number) => {
  if (whatsappProfileCache.number === number && whatsappProfileCache.expiresAt > Date.now()) {
    return whatsappProfileCache.imageUrl;
  }
  try {
    const response = await fetch(`https://api.whatsapp.com/send/?phone=${number}&text&type=phone_number&app_absent=0`, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "text/html" },
    });
    if (!response.ok) throw new Error(`WhatsApp merespons dengan status ${response.status}.`);
    const html = await readLimitedText(response, 256 * 1024);
    const imageMeta = html.match(/<meta\b(?=[^>]*\bproperty=["']og:image["'])[^>]*>/i)?.[0];
    const rawImageUrl = imageMeta?.match(/\bcontent=["']([^"']*)["']/i)?.[1]
      ?.replace(/&amp;/gi, "&")
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
    let imageUrl = "";
    if (rawImageUrl) {
      const parsed = new URL(rawImageUrl);
      if (parsed.protocol === "https:" && parsed.hostname === "pps.whatsapp.net") imageUrl = parsed.href;
    }
    whatsappProfileCache = { number, imageUrl, expiresAt: Date.now() + 60 * 60 * 1000 };
    return imageUrl;
  } catch (error) {
    console.warn("WhatsApp profile image unavailable for link preview:", error.message);
    whatsappProfileCache = { number, imageUrl: "", expiresAt: Date.now() + 60 * 1000 };
    return "";
  }
};
const setSessionCookie = (res, id, maxAge = sessionLifetime) => res.cookie(sessionCookie, id, {
  httpOnly: true, sameSite: "strict", secure: production, path: "/", maxAge,
});
const clearSessionCookie = (res) => res.clearCookie(sessionCookie, {
  httpOnly: true, sameSite: "strict", secure: production, path: "/",
});
const fail = (status, message) => Object.assign(new Error(message), { status });
const isUniqueViolation = (error) => error?.code === "23505";

app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false, limit: "24kb" }));
app.use(express.json({ limit: "24kb" }));
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  });
  if (production) res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});
app.use(async (req, res, next) => {
  try {
    const cookie = req.headers.cookie?.split(";").map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${sessionCookie}=`));
    const id = cookie?.slice(sessionCookie.length + 1);
    if (!id || !/^[a-f0-9]{64}$/.test(id)) return next();
    const session = await store.getSession(id);
    if (!session || session.expires_at < Date.now()) {
      if (session) await store.deleteSession(id);
      clearSessionCookie(res);
      return next();
    }
    req.session = session;
    if (session.admin_id && session.username) req.admin = { id: session.admin_id, username: session.username };
    next();
  } catch (error) {
    next(error);
  }
});

const requireAdmin = (req, res, next) => {
  if (!req.admin) return res.status(401).json({ error: "Sesi admin tidak valid. Silakan masuk kembali." });
  next();
};
const requireCsrf = (req, res, next) => {
  if (!req.session || !constantTimeEquals(req.get("X-CSRF-Token"), req.session.csrf_token)) {
    return res.status(403).json({ error: "Permintaan kedaluwarsa atau tidak valid. Muat ulang halaman." });
  }
  next();
};
const audit = async (adminId, action) => {
  try {
    await store.auditInsert(adminId || null, action);
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
};

app.get("/api/site", async (req, res) => {
  const [settings, commands, faqs, contacts] = await Promise.all([
    store.settings(),
    store.visibleRows("commands"),
    store.visibleRows("faqs"),
    store.contactRows(),
  ]);
  res.json({ settings, commands, faqs, contacts });
});

app.get("/nomor", async (req, res) => {
  const settings = await store.settings();
  if (!validWhatsAppNumber(settings.bot_number)) {
    return res.status(503).type("text/plain").send("Nomor WhatsApp bot belum dikonfigurasi.");
  }
  const number = normaliseNumber(settings.bot_number);
  if (!isPreviewCrawler(req.get("user-agent"))) {
    return res.redirect(302, `https://wa.me/${number}`);
  }
  const brand = String(settings.brand_name || "WhatsApp Bot").trim();
  const title = `Chat ${brand} di WhatsApp`;
  const description = `Mulai percakapan langsung dengan ${brand} melalui WhatsApp.`;
  const profileImage = await whatsappProfileImage(number);
  const fallbackImage = [settings.og_image, settings.logo_url]
    .map((value) => safeUrl(value))
    .find((value) => /^https:\/\//i.test(value)) || "";
  const image = profileImage || fallbackImage;
  res.set("Cache-Control", "public, max-age=300");
  res.type("html").send(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="title" content="${escapeHtml(title)}"><meta name="description" content="${escapeHtml(description)}"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:site_name" content="${escapeHtml(brand)}">${image ? `<meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:secure_url" content="${escapeHtml(image)}"><meta property="og:image:alt" content="Foto profil ${escapeHtml(brand)}">` : ""}<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}">${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ""}<title>${escapeHtml(title)}</title></head><body><a href="https://wa.me/${number}">Chat ${escapeHtml(brand)} di WhatsApp</a></body></html>`);
});

app.get("/api/admin/session", async (req, res) => {
  if (req.admin) return res.json({ authenticated: true, admin: req.admin, csrfToken: req.session.csrf_token });
  const id = randomToken();
  const csrfToken = randomToken();
  await store.createAnonymousSession(id, csrfToken, Date.now() + 10 * 60 * 1000);
  setSessionCookie(res, id, 10 * 60 * 1000);
  res.json({ authenticated: false, csrfToken });
});

app.post("/api/admin/login", async (req, res) => {
  if (!req.session || !constantTimeEquals(req.get("X-CSRF-Token"), req.session.csrf_token)) {
    return res.status(403).json({ error: "Sesi masuk kedaluwarsa. Muat ulang halaman." });
  }
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const attempt = loginAttempts.get(key) || { count: 0, until: 0 };
  if (attempt.until > Date.now()) return res.status(429).json({ error: "Terlalu banyak percobaan. Coba lagi beberapa menit." });

  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const account = await store.getAdminByUsername(username);
  let verified = false;
  if (account) {
    const [, salt, expectedHex] = account.password_hash.split("$");
    const actual = await scrypt(password, salt, scryptCost);
    verified = constantTimeEquals(actual, Buffer.from(expectedHex, "hex"));
  } else {
    await scrypt(password, "chibot-invalid-user-salt", scryptCost);
  }
  if (!account || !verified) {
    attempt.count += 1;
    if (attempt.count >= 10) attempt.until = Date.now() + 15 * 60 * 1000;
    loginAttempts.set(key, attempt);
    return res.status(attempt.until > Date.now() ? 429 : 401).json({ error: "Username atau kata sandi salah." });
  }

  loginAttempts.delete(key);
  await store.deleteSession(req.session.id);
  const id = randomToken();
  const csrfToken = randomToken();
  await store.createSession(id, account.id, csrfToken, Date.now() + sessionLifetime);
  setSessionCookie(res, id);
  await audit(account.id, "Admin signed in");
  res.json({ admin: { id: account.id, username: account.username }, csrfToken });
});

app.post("/api/admin/logout", requireAdmin, requireCsrf, async (req, res) => {
  await store.deleteSession(req.session.id);
  await audit(req.admin.id, "Admin signed out");
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  const [settings, counts, activity] = await Promise.all([store.settings(), store.counts(), store.recentAudit()]);
  res.json({ settings, counts, activity });
});

const settingFields = [
  { key: "brand_name", label: "Nama brand", required: true, max: 60 },
  { key: "logo_url", label: "URL logo", max: 500, url: true },
  { key: "favicon_url", label: "URL favicon", max: 500, url: true },
  { key: "hero_title", label: "Judul utama", required: true, max: 110 },
  { key: "hero_description", label: "Deskripsi utama", required: true, max: 320 },
  { key: "site_description", label: "Deskripsi situs", required: true, max: 300 },
  { key: "bot_number", label: "Nomor WhatsApp bot", max: 30 },
  { key: "support_number", label: "Nomor WhatsApp dukungan", max: 30 },
  { key: "bot_status", label: "Catatan status", options: ["Belum dikonfigurasi", "Terakhir diketahui online", "Terakhir diketahui offline"] },
  { key: "github_url", label: "Tautan GitHub", max: 500, url: true },
  { key: "documentation_url", label: "Tautan dokumentasi", max: 500, url: true },
  { key: "social_url", label: "Tautan media sosial", max: 500, url: true },
  { key: "seo_title", label: "Judul SEO", required: true, max: 70 },
  { key: "seo_description", label: "Deskripsi meta", required: true, max: 180 },
  { key: "og_image", label: "Gambar Open Graph", max: 500, url: true },
  { key: "copyright", label: "Nama hak cipta", max: 120 },
  { key: "default_theme", label: "Tema default", options: ["light", "dark"] },
  ...[
    ["home", "Beranda", "#home"], ["commands", "Perintah", "#commands"],
    ["documentation", "Dokumentasi", ""], ["contact", "Kontak", "#contact"],
  ].flatMap(([key, label, defaultUrl]) => [
    { key: `nav_${key}_label`, label: `Label menu ${label}`, required: true, max: 30 },
    { key: `nav_${key}_url`, label: `Tautan menu ${label}`, required: key !== "documentation", max: 500, navigationUrl: true, defaultUrl },
  ]),
];
const appearanceKeys = ["color_primary", "color_accent", "color_background", "color_text", "color_card", "color_border"];
const imageKeys = ["logo_url", "favicon_url", "og_image"];
const validateSettings = (body, keys = settingFields.map(({ key }) => key)) => {
  const fields = settingFields.filter((field) => keys.includes(field.key));
  const values = {};
  for (const field of fields) {
    const value = String(body[field.key] || "").trim();
    if (field.required && !value) throw fail(400, `${field.label} wajib diisi.`);
    if (value.length > field.max) throw fail(400, `${field.label} maksimal ${field.max} karakter.`);
    if (["bot_number", "support_number"].includes(field.key) && value && !/^\d{8,15}$/.test(normaliseNumber(value))) {
      throw fail(400, `${field.label} harus berisi 8–15 digit termasuk kode negara.`);
    }
    if (field.options && !field.options.includes(value)) throw fail(400, `Pilihan ${field.label} tidak valid.`);
    if (field.navigationUrl && value && !safeNavigationUrl(value)) throw fail(400, `${field.label} harus berupa anchor, URL HTTPS, atau jalur situs.`);
    if (field.url && value && (!safeUrl(value) || (!/^https:\/\//i.test(value) && !value.startsWith("/")))) {
      throw fail(400, `${field.label} harus berupa URL HTTPS atau jalur situs.`);
    }
    values[field.key] = value;
  }
  return values;
};

app.get("/api/admin/settings", requireAdmin, async (req, res) => {
  res.json({ settings: await store.settings() });
});
app.put("/api/admin/settings", requireAdmin, requireCsrf, async (req, res) => {
  const values = validateSettings(req.body);
  await store.saveSettings(values);
  await audit(req.admin.id, "Updated website settings");
  res.json({ ok: true, settings: await store.settings() });
});
app.put("/api/admin/appearance", requireAdmin, requireCsrf, async (req, res) => {
  const values = {};
  for (const key of appearanceKeys) {
    const value = String(req.body[key] || "").trim();
    if (!/^#[\da-f]{6}$/i.test(value)) throw fail(400, `Warna ${key} tidak valid.`);
    values[key] = value.toUpperCase();
  }
  Object.assign(values, validateSettings(req.body, imageKeys));
  values.default_theme = req.body.default_theme;
  if (!["light", "dark"].includes(values.default_theme)) throw fail(400, "Tema default tidak valid.");
  await store.saveSettings(values);
  await audit(req.admin.id, "Updated website appearance");
  res.json({ ok: true });
});

const resources = {
  features: {
    fields: [
      ["title", "Judul", true, 80], ["description", "Deskripsi", true, 240],
      ["icon", "Ikon", true, 12],
    ],
  },
  commands: {
    fields: [
      ["command", "Perintah", true, 50], ["description", "Deskripsi", true, 240],
      ["category", "Kategori", true, 50], ["usage_example", "Contoh penggunaan", false, 120],
    ],
  },
  faqs: {
    fields: [["question", "Pertanyaan", true, 180], ["answer", "Jawaban", true, 1000]],
  },
  contacts: {
    fields: [["label", "Label", true, 80], ["type", "Jenis kontak", true, 40],
      ["value", "Nilai tampilan", true, 160], ["url", "URL tautan", false, 500]],
  },
};
const resourceFor = (table) => {
  if (!contentTables.has(table)) throw fail(404, "Jenis konten tidak ditemukan.");
  return resources[table];
};
const validateResource = (table, body, creating = false) => {
  const resource = resourceFor(table);
  const values = {};
  for (const [key, label, required, max] of resource.fields) {
    const value = String(body[key] || "").trim();
    if (required && !value) throw fail(400, `${label} wajib diisi.`);
    if (value.length > max) throw fail(400, `${label} maksimal ${max} karakter.`);
    if (key === "command" && !/^\.[a-zA-Z0-9_-]+$/.test(value)) {
      throw fail(400, "Perintah harus dimulai dengan titik, lalu huruf, angka, _ atau -.");
    }
    if (key === "url" && value && (!safeUrl(value) || !/^https:\/\//i.test(value))) {
      throw fail(400, "URL kontak harus menggunakan HTTPS.");
    }
    values[key] = value;
  }
  values.is_visible = creating ? body.is_visible !== false : body.is_visible === true;
  return values;
};

app.get("/api/admin/content/:table", requireAdmin, async (req, res) => {
  resourceFor(req.params.table);
  res.json({ items: await store.resourceList(req.params.table, String(req.query.search || "").trim().slice(0, 80)) });
});
app.post("/api/admin/content/:table", requireAdmin, requireCsrf, async (req, res) => {
  resourceFor(req.params.table);
  const row = { ...validateResource(req.params.table, req.body, true), id: randomUUID() };
  await store.resourceCreate(req.params.table, row);
  await audit(req.admin.id, `Created ${req.params.table} entry`);
  res.status(201).json({ item: row });
});
app.get("/api/admin/content/:table/:id", requireAdmin, async (req, res) => {
  resourceFor(req.params.table);
  const item = await store.resourceGet(req.params.table, req.params.id);
  if (!item) throw fail(404, "Konten tidak ditemukan.");
  res.json({ item });
});
app.put("/api/admin/content/:table/:id", requireAdmin, requireCsrf, async (req, res) => {
  resourceFor(req.params.table);
  const item = {
    ...validateResource(req.params.table, req.body),
    updated_at: new Date().toISOString(),
  };
  const updated = await store.resourceUpdate(req.params.table, req.params.id, item);
  if (!updated) throw fail(404, "Konten tidak ditemukan.");
  await audit(req.admin.id, `Updated ${req.params.table} entry`);
  res.json({ ok: true });
});
app.delete("/api/admin/content/:table/:id", requireAdmin, requireCsrf, async (req, res) => {
  resourceFor(req.params.table);
  const deleted = await store.resourceDelete(req.params.table, req.params.id);
  if (!deleted) throw fail(404, "Konten tidak ditemukan.");
  await audit(req.admin.id, `Deleted ${req.params.table} entry`);
  res.json({ ok: true });
});

app.put("/api/admin/profile", requireAdmin, requireCsrf, async (req, res) => {
  const username = String(req.body.username || "").trim();
  const currentPassword = String(req.body.current_password || "");
  const newPassword = String(req.body.new_password || "");
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) throw fail(400, "Username harus berisi 3–40 karakter yang valid.");
  if (newPassword && (newPassword.length < 12 || newPassword.length > 200)) throw fail(400, "Kata sandi baru harus berisi 12–200 karakter.");
  const account = await store.getAdminById(req.admin.id);
  if (!account) throw fail(404, "Akun admin tidak ditemukan.");
  const [, salt, expectedHex] = account.password_hash.split("$");
  if (!constantTimeEquals(await scrypt(currentPassword, salt, scryptCost), Buffer.from(expectedHex, "hex"))) {
    throw fail(401, "Kata sandi saat ini salah.");
  }
  let passwordHash = account.password_hash;
  if (newPassword) {
    const nextSalt = randomBytes(16).toString("hex");
    passwordHash = `scrypt$${nextSalt}$${(await scrypt(newPassword, nextSalt, scryptCost)).toString("hex")}`;
  }
  await store.updateAdmin(account.id, { username, password_hash: passwordHash });
  await audit(req.admin.id, "Updated admin profile");
  res.json({ ok: true, admin: { id: account.id, username } });
});

app.post("/api/admin/upload", requireAdmin, (req, res, next) => {
  upload.single("asset")(req, res, async (error) => {
    if (error) return res.status(400).json({ error: "Gambar tidak valid atau melebihi batas 3 MB." });
    if (!req.session || !constantTimeEquals(req.body?._csrf, req.session.csrf_token)) {
      return res.status(403).json({ error: "Sesi unggah tidak valid. Muat ulang halaman." });
    }
    if (!req.file) return res.status(400).json({ error: "Pilih gambar terlebih dahulu." });
    const buffer = req.file.buffer;
    let extension = "";
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) extension = ".png";
    else if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) extension = ".jpg";
    else if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") extension = ".webp";
    else if (buffer.length >= 6 && buffer.toString("ascii", 0, 4) === "\0\0\u0001\0") extension = ".ico";
    if (!extension) return res.status(400).json({ error: "Format gambar yang didukung: PNG, JPEG, WebP, ICO." });
    const filename = `${randomUUID()}${extension}`;
    try {
      mkdirSync(staticUploads, { recursive: true });
      writeFileSync(resolve(staticUploads, filename), buffer, { flag: "wx" });
      res.json({ url: `/uploads/${filename}` });
    } catch (writeError) {
      next(writeError);
    }
  });
});

app.use("/uploads", express.static(staticUploads, {
  maxAge: production ? "7d" : 0,
  fallthrough: false,
  setHeaders(res) { res.set("X-Content-Type-Options", "nosniff"); },
}));
app.use("/api", (req, res) => res.status(404).json({ error: "Endpoint API tidak ditemukan." }));
app.use(express.static(staticDirectory, { index: false, maxAge: production ? "1d" : 0 }));
app.get("/robots.txt", (req, res) => res.type("text/plain").send("User-agent: *\nAllow: /\nDisallow: /admin\n"));
app.get("/sitemap.xml", (req, res) => {
  const origin = `${req.protocol}://${req.get("host")}`;
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`);
});
app.get(/.*/, (req, res, next) => {
  res.sendFile(resolve(staticDirectory, "index.html"), (error) => {
    if (error) next(fail(404, "Frontend Vue belum dibuat. Jalankan npm run build."));
  });
});

app.use((error, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, error);
  if (res.headersSent) return next(error);
  if (req.path.startsWith("/api/")) {
    const status = error.status || (isUniqueViolation(error) ? 409 : 500);
    return res.status(status).json({
      error: isUniqueViolation(error) ? "Username sudah digunakan." : (error.status ? error.message : "Terjadi kesalahan. Silakan coba kembali."),
    });
  }
  res.status(error.status || 500).send(error.status ? error.message : "Terjadi kesalahan. Silakan coba kembali.");
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
if (!process.env.VERCEL) {
  app.listen(port, host, () => console.log(`Chibot API listening at http://${host}:${port}`));
}

export default app;
