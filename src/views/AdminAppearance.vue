<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { api, getCsrfToken } from "../api.js";

const keys = [
  ["color_primary", "Warna utama"], ["color_accent", "Warna aksen"],
  ["color_background", "Latar halaman"], ["color_card", "Latar kartu"],
  ["color_text", "Warna teks"], ["color_border", "Warna border"],
];
const assets = [["logo_url", "Logo"], ["favicon_url", "Favicon"], ["og_image", "Gambar Open Graph"]];
const form = reactive({});
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const success = ref("");
const previewStyle = computed(() => ({
  "--preview-bg": form.color_background,
  "--preview-card": form.color_card,
  "--preview-ink": form.color_text,
  "--preview-primary": form.color_primary,
  "--preview-border": form.color_border,
}));

onMounted(async () => {
  try {
    const result = await api("/api/admin/settings");
    Object.assign(form, result.settings);
  } catch (cause) {
    error.value = cause.message;
  } finally {
    loading.value = false;
  }
});

async function uploadImage(event, key) {
  const file = event.target.files?.[0];
  if (!file) return;
  const body = new FormData();
  body.append("asset", file);
  body.append("_csrf", getCsrfToken());
  try {
    const result = await api("/api/admin/upload", { method: "POST", body });
    form[key] = result.url;
  } catch (cause) {
    error.value = cause.message;
  } finally {
    event.target.value = "";
  }
}

async function save() {
  saving.value = true;
  error.value = "";
  success.value = "";
  try {
    await api("/api/admin/appearance", { method: "PUT", body: JSON.stringify(form) });
    success.value = "Tampilan berhasil disimpan.";
  } catch (cause) {
    error.value = cause.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <div class="admin-page-heading"><div><span class="section-kicker">IDENTITAS VISUAL</span><h1>Tampilan</h1></div></div>
    <p v-if="loading" class="loading-state">Memuat tampilan...</p>
    <form v-else class="admin-card settings-form" @submit.prevent="save">
      <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
      <div class="appearance-grid">
        <label v-for="[key, label] in keys" :key="key" class="form-field color-field"><span>{{ label }}</span><input v-model="form[key]" type="color"></label>
      </div>
      <div class="appearance-assets settings-grid">
        <label v-for="[key, label] in assets" :key="key" class="form-field"><span>{{ label }}</span><input v-model="form[key]" maxlength="500" placeholder="URL HTTPS atau jalur situs"><input type="file" accept="image/png,image/jpeg,image/webp,image/x-icon" @change="uploadImage($event, key)"><small>Format PNG, JPEG, WebP, atau ICO; maksimal 3 MB.</small></label>
      </div>
      <label class="form-field"><span>Tema default pengunjung</span><select v-model="form.default_theme"><option value="light">Terang</option><option value="dark">Gelap</option></select></label>
      <div class="theme-preview" :style="previewStyle"><span class="section-kicker">PRATINJAU LANGSUNG</span><div><strong>{{ form.brand_name }}</strong><p>WhatsApp-mu, lebih praktis.</p><button type="button">Contoh tombol</button></div></div>
      <p class="form-hint">Gunakan kode warna valid. Perubahan diterapkan ke situs setelah disimpan.</p>
      <div class="form-footer"><button class="button button-dark" type="submit" :disabled="saving">{{ saving ? "Menyimpan..." : "Simpan tampilan" }} <span aria-hidden="true">↗</span></button><span class="save-feedback" role="status">{{ success }}</span></div>
    </form>
  </div>
</template>
