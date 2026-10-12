<script setup>
import { onMounted, reactive, ref } from "vue";
import { api } from "../api.js";

const sections = [
  { title: "Identitas & konten", fields: [
    ["brand_name", "Nama brand", true], ["logo_url", "URL logo"], ["favicon_url", "URL favicon"],
    ["hero_title", "Judul utama", true], ["hero_description", "Deskripsi utama", true, true],
    ["site_description", "Deskripsi situs", true, true],
  ] },
  { title: "WhatsApp", fields: [
    ["bot_number", "Nomor WhatsApp bot"], ["support_number", "Nomor WhatsApp dukungan"],
    ["bot_status", "Catatan status bot"],
  ] },
  { title: "Navigasi", fields: [
    ["nav_home_label", "Label menu beranda", true], ["nav_home_url", "Tautan menu beranda", true],
    ["nav_commands_label", "Label menu perintah", true], ["nav_commands_url", "Tautan menu perintah", true],
    ["nav_contact_label", "Label menu kontak", true], ["nav_contact_url", "Tautan menu kontak", true],
  ] },
  { title: "Tautan & SEO", fields: [
    ["github_url", "Tautan GitHub"], ["social_url", "Tautan media sosial"],
    ["seo_title", "Judul SEO", true], ["seo_description", "Deskripsi meta", true, true],
    ["og_image", "URL gambar Open Graph"], ["copyright", "Nama hak cipta"],
    ["default_theme", "Tema default", true],
  ] },
];
const multilineKeys = new Set(["hero_description", "site_description", "seo_description"]);
const form = reactive({});
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const success = ref("");

async function loadSettings() {
  try {
    const result = await api("/api/admin/settings");
    Object.assign(form, result.settings);
  } catch (cause) {
    error.value = cause.message;
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  saving.value = true;
  error.value = "";
  success.value = "";
  try {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(form) });
    success.value = "Pengaturan berhasil disimpan.";
  } catch (cause) {
    error.value = cause.message;
  } finally {
    saving.value = false;
  }
}

onMounted(loadSettings);
</script>

<template>
  <div>
    <div class="admin-page-heading"><div><span class="section-kicker">KONFIGURASI SITUS</span><h1>Pengaturan situs</h1></div></div>
    <p v-if="loading" class="loading-state">Memuat pengaturan...</p>
    <form v-else class="admin-card settings-form" @submit.prevent="saveSettings">
      <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
      <section v-for="section in sections" :key="section.title" class="settings-section">
        <div class="admin-card-heading"><div><span class="section-kicker">PENGATURAN</span><h2>{{ section.title }}</h2></div></div>
        <div class="settings-grid">
          <label v-for="[key, label, required] in section.fields" :key="key" class="form-field">
            <span>{{ label }}</span>
            <textarea v-if="multilineKeys.has(key)" v-model="form[key]" rows="3" maxlength="320" :required="required"></textarea>
            <select v-else-if="key === 'bot_status'" v-model="form[key]"><option>Belum dikonfigurasi</option><option>Terakhir diketahui online</option><option>Terakhir diketahui offline</option></select>
            <select v-else-if="key === 'default_theme'" v-model="form[key]"><option value="light">Terang</option><option value="dark">Gelap</option></select>
            <input v-else v-model="form[key]" :required="required" :maxlength="key.includes('_label') ? 30 : 500">
          </label>
        </div>
      </section>
      <p class="form-hint">Nomor WhatsApp harus mencakup kode negara. Status bot adalah catatan manual, bukan status langsung.</p>
      <div class="form-footer"><button class="button button-dark" type="submit" :disabled="saving">{{ saving ? "Menyimpan..." : "Simpan perubahan" }} <span aria-hidden="true">↗</span></button><span class="save-feedback" role="status">{{ success }}</span></div>
    </form>
  </div>
</template>
