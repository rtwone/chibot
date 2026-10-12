<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { api } from "../api.js";

const siteData = ref(null);
const error = ref("");
const menuOpen = ref(false);
const search = ref("");
const category = ref("");
const commandPage = ref(1);
const toast = ref("");
const themeToggleLabel = ref("Ganti tema warna");
const theme = ref("light");

const settings = computed(() => siteData.value?.settings || {});
const botDigits = computed(() => String(settings.value.bot_number || "").replace(/\D/g, ""));
const supportDigits = computed(() => String(settings.value.support_number || "").replace(/\D/g, ""));
const commands = computed(() => siteData.value?.commands || []);
const features = computed(() => siteData.value?.features || []);
const faqs = computed(() => siteData.value?.faqs || []);
const contacts = computed(() => siteData.value?.contacts || []);
const categories = computed(() => [...new Set(commands.value.map((item) => item.category))]);
const filteredCommands = computed(() => commands.value.filter((item) => {
  const query = search.value.trim().toLocaleLowerCase();
  const matchesText = !query || `${item.command} ${item.description} ${item.category}`.toLocaleLowerCase().includes(query);
  return matchesText && (!category.value || item.category === category.value);
}));
const commandPageCount = computed(() => Math.ceil(filteredCommands.value.length / 10));
const paginatedCommands = computed(() => {
  const start = (commandPage.value - 1) * 10;
  return filteredCommands.value.slice(start, start + 10);
});
watch([search, category], () => { commandPage.value = 1; });
const year = new Date().getFullYear();
let toastTimer;

function notify(message) {
  toast.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.value = ""; }, 2200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    notify("Berhasil disalin.");
  } catch {
    notify("Gagal menyalin. Periksa izin clipboard browser.");
  }
}

function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme.value;
  localStorage.setItem("chibot-theme", theme.value);
  themeToggleLabel.value = `Ganti ke mode ${theme.value === "dark" ? "gelap" : "terang"}`;
}

function navigationLink(key, fallback) {
  const value = settings.value[`nav_${key}_url`];
  return safeLink(value, true) || fallback;
}

function safeLink(value, allowAnchor = false) {
  const url = String(value || "").trim();
  if (allowAnchor && /^#[\w-]+$/.test(url)) return url;
  if (/^\/(?!\/)/.test(url) || /^https:\/\//i.test(url)) return url;
  return "";
}

onMounted(async () => {
  const saved = localStorage.getItem("chibot-theme");
  theme.value = saved === "light" || saved === "dark" ? saved : "light";
  document.documentElement.dataset.theme = theme.value;
  try {
    siteData.value = await api("/api/site");
    const title = settings.value.seo_title || settings.value.brand_name;
    document.title = title || "Chibot — WhatsApp-mu, Lebih Cerdas";
    const description = settings.value.seo_description || settings.value.site_description;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description || "");
    if (settings.value.favicon_url) document.querySelector('link[rel="icon"]')?.setAttribute("href", settings.value.favicon_url);
    if (!saved && settings.value.default_theme === "dark") {
      theme.value = "dark";
      document.documentElement.dataset.theme = "dark";
    }
  } catch (cause) {
    error.value = cause.message;
  }
});
</script>

<template>
  <div v-if="error" class="page-error" role="alert">
    <strong>Situs belum dapat dimuat.</strong>
    <p>{{ error }}</p>
    <p>Pastikan server API berjalan dan konfigurasi Supabase sudah benar.</p>
  </div>
  <template v-else-if="siteData">
    <a class="skip-link" href="#main">Lewati ke konten</a>
    <header class="navbar">
      <a class="brand" href="/" :aria-label="`Beranda ${settings.brand_name}`">
        <img v-if="safeLink(settings.logo_url)" class="brand-logo" :src="safeLink(settings.logo_url)" alt="">
        <span v-else class="brand-mark" aria-hidden="true">✳</span>
        <span>{{ settings.brand_name }}</span>
      </a>
      <button class="menu-toggle" type="button" :aria-expanded="menuOpen" aria-controls="site-nav" @click="menuOpen = !menuOpen">
        Menu <span aria-hidden="true">☰</span>
      </button>
      <nav id="site-nav" class="site-nav" :class="{ 'is-open': menuOpen }" aria-label="Navigasi utama">
        <a :href="navigationLink('home', '#home')" @click="menuOpen = false">{{ settings.nav_home_label }}</a>
        <a :href="navigationLink('features', '#features')" @click="menuOpen = false">{{ settings.nav_features_label }}</a>
        <a :href="navigationLink('commands', '#commands')" @click="menuOpen = false">{{ settings.nav_commands_label }}</a>
        <a :href="navigationLink('contact', '#contact')" @click="menuOpen = false">{{ settings.nav_contact_label }}</a>
      </nav>
      <div class="nav-actions">
        <button class="theme-toggle" type="button" :aria-label="themeToggleLabel" @click="toggleTheme"><span aria-hidden="true">☾</span></button>
        <a v-if="botDigits.length >= 8" class="button button-small button-primary" :href="`https://wa.me/${botDigits}`">Chat dengan bot <span aria-hidden="true">↗</span></a>
      </div>
    </header>

    <main id="main">
      <section id="home" class="hero section-wrap">
        <div class="hero-copy">
          <span class="eyebrow"><span class="eyebrow-dot"></span> BOT WHATSAPP BERBASIS BAILEYS</span>
          <h1>{{ settings.hero_title }}</h1>
          <p class="hero-description">{{ settings.hero_description }}</p>
          <div class="hero-actions">
            <a v-if="botDigits.length >= 8" class="button button-primary button-large" :href="`https://wa.me/${botDigits}`">Chat dengan bot <span aria-hidden="true">↗</span></a>
            <a v-else class="button button-primary button-large" href="#bot-number">Nomor bot segera hadir <span aria-hidden="true">↘</span></a>
            <a class="button button-secondary button-large" href="#features">Jelajahi fitur <span aria-hidden="true">↓</span></a>
          </div>
          <p class="hero-proof"><span class="proof-avatars" aria-hidden="true"><b>✳</b><b>⌘</b><b>↗</b></span> AI percakapan, alat YouTube, stiker, dan fitur komunitas.</p>
        </div>
        <div class="hero-art" aria-label="Ilustrasi percakapan dengan bot WhatsApp">
          <span class="decor-star star-one">✳</span><span class="decor-star star-two">✦</span><span class="decor-circle"></span>
          <div class="chat-window">
            <div class="chat-top"><div class="chat-avatar">C</div><div><strong>Bot {{ settings.brand_name }}</strong><small><span class="status-dot status-muted"></span> {{ settings.bot_status }}</small></div><span class="chat-menu">•••</span></div>
            <div class="chat-body"><span class="chat-date">HARI INI</span><div class="chat-bubble bubble-in">Hai! Ada yang bisa saya bantu? <small>9:41</small></div><div class="chat-bubble bubble-out">Cari lagu favoritku ✨ <small>9:42 ✓✓</small></div><div class="chat-bubble bubble-in"><div class="command-chip">.ytsearch</div>Cari lagu atau video YouTube. <small>9:42</small></div></div>
            <div class="chat-compose"><span>Pesan</span><span class="send-button">➤</span></div>
          </div>
          <div class="art-sticker sticker-command"><span>✳</span><strong>Chatbot<br>AI</strong></div><div class="art-sticker sticker-spark">✷</div>
          <div class="art-sticker sticker-status"><span class="status-dot"></span> {{ botDigits.length >= 8 ? "Nomor sudah diatur" : "Sedang disiapkan" }}</div>
        </div>
      </section>

      <section id="bot-number" class="number-section section-wrap">
        <div class="number-card">
          <div class="number-intro"><span class="section-kicker">SAPA BOTNYA</span><h2>Chat langsung dengan Chitanda Eru Bot.</h2><p>Simpan nomor ini dan mulai percakapan kapan pun kamu membutuhkan bantuan.</p></div>
          <div class="number-detail">
            <div class="number-label"><span class="status-dot status-muted"></span> NOMOR RESMI BOT <span class="number-status">{{ settings.bot_status }}</span></div>
            <strong class="bot-number">{{ botDigits.length >= 8 ? `+${botDigits}` : "Atur nomor bot melalui panel admin" }}</strong>
            <div class="number-actions">
              <template v-if="botDigits.length >= 8">
                <a class="button button-dark" :href="`https://wa.me/${botDigits}`">Chat sekarang <span aria-hidden="true">↗</span></a>
                <button class="button button-outline" type="button" @click="copyText(botDigits)">Salin nomor</button>
              </template>
              <a v-else class="button button-outline" href="#contact">Hubungi pengelola</a>
            </div>
            <small class="status-disclaimer">Status diatur secara manual; koneksi status langsung belum tersedia.</small>
          </div>
          <span class="number-spark" aria-hidden="true">✳</span>
        </div>
      </section>

      <section id="features" class="section-wrap section-block">
        <div class="section-heading"><div><span class="section-kicker">KEMAMPUAN CHITANDA ERU BOT</span><h2>Teman chat yang<br><span class="heading-highlight">serba bisa.</span></h2></div><p>Kenali fitur yang tersedia di script bot. AI, utilitas grup, dan pengingat tetap mengikuti konfigurasi serta izin WhatsApp.</p></div>
        <div class="feature-grid">
          <article v-for="(feature, index) in features" :key="feature.id" class="feature-card" :class="`feature-tone-${index % 4}`"><span class="feature-icon" aria-hidden="true">{{ feature.icon }}</span><span class="feature-index">{{ String(index + 1).padStart(2, "0") }}</span><h3>{{ feature.title }}</h3><p>{{ feature.description }}</p><span class="feature-arrow" aria-hidden="true">↗</span></article>
          <p v-if="!features.length" class="empty-note">Fitur sedang disiapkan. Silakan kembali lagi nanti.</p>
        </div>
      </section>

      <section id="commands" class="commands-section">
        <div class="section-wrap section-block">
          <div class="section-heading"><div><span class="section-kicker">PERINTAH DARI SCRIPT BOT</span><h2>Ketik perintahnya.</h2></div><p>Gunakan prefix yang ditampilkan bot. Beberapa perintah hanya berlaku di grup tertentu atau memerlukan izin admin grup.</p></div>
          <div class="command-panel">
            <div class="terminal-top"><div class="terminal-dots"><i></i><i></i><i></i></div><span>DAFTAR PERINTAH</span><span class="terminal-count">{{ commands.length }} perintah</span></div>
            <div class="command-tools"><label class="search-box"><span aria-hidden="true">⌕</span><input v-model="search" type="search" placeholder="Cari perintah..." aria-label="Cari perintah"></label><label class="visually-hidden" for="command-category">Filter berdasarkan kategori</label><select id="command-category" v-model="category"><option value="">Semua kategori</option><option v-for="value in categories" :key="value" :value="value">{{ value }}</option></select></div>
            <div class="command-list"><article v-for="command in paginatedCommands" :key="command.id" class="command-row"><div class="command-title"><code>{{ command.command }}</code><span class="category-pill">{{ command.category }}</span></div><p>{{ command.description }}</p><div class="command-example"><code>{{ command.usage_example || command.command }}</code><button class="copy-command" type="button" :aria-label="`Salin perintah ${command.command}`" @click="copyText(command.command)">Salin</button></div></article><p v-if="!filteredCommands.length" class="empty-note">Tidak ada perintah yang cocok dengan pencarianmu.</p><nav v-if="commandPageCount > 1" class="command-pagination" aria-label="Navigasi halaman perintah"><span class="command-page-status">Halaman {{ commandPage }} dari {{ commandPageCount }}</span><div><button class="command-page-button" type="button" :disabled="commandPage === 1" @click="commandPage -= 1">Sebelumnya</button><button class="command-page-button" type="button" :disabled="commandPage === commandPageCount" @click="commandPage += 1">Berikutnya</button></div></nav></div>
          </div>
        </div>
      </section>

      <section id="how-it-works" class="section-wrap section-block">
        <div class="section-heading"><div><span class="section-kicker">MULAI DALAM TIGA LANGKAH</span><h2>Ngobrol atau<br>gunakan perintah.</h2></div><p>Fitur AI tersedia jika provider AI bot sudah dikonfigurasi. Daftar perintah dapat dilihat langsung di WhatsApp.</p></div>
        <div class="steps-grid"><article v-for="step in [{number:'01',title:'Buka WhatsApp',description:'Mulai chat melalui nomor bot yang telah diatur pada halaman ini.',icon:'◌'},{number:'02',title:'Kirim pesan atau mention',description:'Chat pribadi untuk ngobrol dengan AI, atau mention bot di grup.',icon:'✉'},{number:'03',title:'Coba .menu',description:'Lihat perintah media, komunitas, grup, dan produktivitas yang tersedia.',icon:'⌘'}]" :key="step.number" class="step-card"><span class="step-number">{{ step.number }}</span><span class="step-icon" aria-hidden="true">{{ step.icon }}</span><h3>{{ step.title }}</h3><p>{{ step.description }}</p></article></div>
      </section>

      <section class="stats-strip"><div class="section-wrap stats-inner"><div><span class="section-kicker">DIBUAT UNTUK CHAT YANG PRAKTIS</span><h2>Yang kamu butuhkan.<br>Tanpa yang berlebihan.</h2></div><div class="stats-item"><strong>{{ commands.length }}</strong><span>perintah tercatat</span></div><div class="stats-item"><strong>{{ features.length }}</strong><span>fitur tercatat</span></div><p class="stats-disclaimer">Jumlah ini hanya menghitung konten yang tampil, bukan penggunaan atau waktu aktif bot.</p></div></section>

      <section id="faq" class="section-wrap section-block faq-section">
        <div class="section-heading"><div><span class="section-kicker">INFO YANG PERLU DIKETAHUI</span><h2>Ada pertanyaan?<br>Kami siap membantu.</h2></div><p>Butuh bantuan lebih lanjut? Hubungi kontak dukungan di bawah ini.</p></div>
        <div class="faq-list"><details v-for="(faq, index) in faqs" :key="faq.id" class="faq-item"><summary><span>{{ faq.question }}</span><span class="faq-plus" aria-hidden="true">{{ index === 0 ? "−" : "+" }}</span></summary><p>{{ faq.answer }}</p></details><p v-if="!faqs.length" class="empty-note">FAQ sedang disiapkan.</p></div>
      </section>

      <section class="contact-banner section-wrap"><div><span class="section-kicker">YUK, TERHUBUNG</span><h2>Punya pertanyaan,<br>ide, atau ingin menyapa?</h2><p>Hubungi pengelola melalui kontak dukungan yang tersedia.</p></div><div class="contact-actions"><a v-if="supportDigits.length >= 8" class="button button-dark button-large" :href="`https://wa.me/${supportDigits}`">Hubungi Owner <span aria-hidden="true">↗</span></a><span v-else class="support-placeholder">Kontak dukungan belum diatur.</span><a class="text-link" href="#contact">Lihat tautan kami <span aria-hidden="true">↓</span></a></div><span class="contact-decoration" aria-hidden="true">✳</span></section>
    </main>

    <footer id="contact" class="footer"><div class="footer-top"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">✳</span><span>{{ settings.brand_name }}</span></a><p>{{ settings.site_description }}</p><div class="footer-links"><template v-for="contact in contacts" :key="contact.id"><a v-if="safeLink(contact.url)" :href="safeLink(contact.url)" :target="safeLink(contact.url).startsWith('https:') ? '_blank' : undefined" :rel="safeLink(contact.url).startsWith('https:') ? 'noreferrer' : undefined">{{ contact.label }}{{ contact.value ? `: ${contact.value}` : "" }}</a><span v-else>{{ contact.label }}{{ contact.value ? `: ${contact.value}` : "" }}</span></template><a v-if="safeLink(settings.github_url)" :href="safeLink(settings.github_url)" target="_blank" rel="noreferrer">GitHub</a><a v-if="safeLink(settings.social_url)" :href="safeLink(settings.social_url)" target="_blank" rel="noreferrer">Media sosial</a></div></div><div class="footer-bottom"><span>© {{ year }} {{ settings.copyright || settings.brand_name }}. Untuk percakapan yang lebih praktis.</span><span class="footer-note">Ketersediaan WhatsApp bergantung pada pengelola bot.</span></div></footer>
    <div v-if="toast" class="toast-message" role="status">{{ toast }}</div>
  </template>
  <main v-else class="loading-state" aria-live="polite">Memuat halaman…</main>
</template>

<style scoped>
.page-error { width: min(620px, 90%); margin: 12vh auto; padding: 24px; border: 2px solid #101010; box-shadow: 5px 5px #101010; background: #fff; color: #101010; }
.page-error strong { font-size: 22px; }
.page-error p { margin-bottom: 0; }
</style>
