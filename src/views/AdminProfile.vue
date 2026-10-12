<script setup>
import { onMounted, reactive, ref } from "vue";
import { api } from "../api.js";

const form = reactive({ username: "", current_password: "", new_password: "" });
const saving = ref(false);
const error = ref("");
const success = ref("");

onMounted(async () => {
  try {
    const session = await api("/api/admin/session");
    form.username = session.admin?.username || "";
  } catch (cause) {
    error.value = cause.message;
  }
});

async function save() {
  saving.value = true;
  error.value = "";
  success.value = "";
  try {
    await api("/api/admin/profile", { method: "PUT", body: JSON.stringify(form) });
    success.value = "Profil berhasil diperbarui.";
    form.current_password = "";
    form.new_password = "";
  } catch (cause) {
    error.value = cause.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <div class="admin-page-heading"><div><span class="section-kicker">AKUN PENGELOLA</span><h1>Profil admin</h1></div></div>
    <form class="admin-card profile-form" @submit.prevent="save">
      <p>Perbarui akses untuk mengelola situs. Kata sandi disimpan menggunakan hashing scrypt.</p>
      <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
      <label class="form-field">Username<input v-model="form.username" required minlength="3" maxlength="40" pattern="[A-Za-z0-9._-]+" autocomplete="username"></label>
      <label class="form-field">Kata sandi saat ini<input v-model="form.current_password" type="password" required maxlength="200" autocomplete="current-password"></label>
      <label class="form-field">Kata sandi baru <small>Kosongkan jika tidak ingin mengganti kata sandi.</small><input v-model="form.new_password" type="password" minlength="12" maxlength="200" autocomplete="new-password"></label>
      <div class="admin-form-actions"><button class="button button-dark" type="submit" :disabled="saving">{{ saving ? "Menyimpan..." : "Simpan profil" }} <span aria-hidden="true">↗</span></button><span class="save-feedback" role="status">{{ success }}</span></div>
    </form>
  </div>
</template>
