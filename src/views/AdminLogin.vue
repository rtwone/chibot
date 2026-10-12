<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api, initializeAdminSession, setCsrfToken } from "../api.js";

const router = useRouter();
const form = reactive({ username: "", password: "" });
const error = ref("");
const loading = ref(false);

onMounted(async () => {
  try {
    const session = await initializeAdminSession();
    if (session.authenticated) router.replace("/admin/dashboard");
  } catch (cause) {
    error.value = cause.message;
  }
});

async function login() {
  loading.value = true;
  error.value = "";
  try {
    const result = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setCsrfToken(result.csrfToken);
    await router.push("/admin/dashboard");
  } catch (cause) {
    error.value = cause.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="login-body">
    <section class="login-card">
      <RouterLink class="brand login-brand" to="/"><span class="brand-mark">✳</span><span>Chibot <small>STUDIO</small></span></RouterLink>
      <span class="section-kicker">PANEL PENGELOLA</span>
      <h1>Selamat datang.</h1>
      <p>Masuk untuk mengelola situs bot WhatsApp.</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <form class="stack-form" @submit.prevent="login">
        <label>Username<input v-model="form.username" name="username" required minlength="3" maxlength="40" autocomplete="username"></label>
        <label>Kata sandi<input v-model="form.password" name="password" type="password" required maxlength="200" autocomplete="current-password"></label>
        <button class="button button-dark button-large" type="submit" :disabled="loading">{{ loading ? "Memeriksa..." : "Masuk" }} <span aria-hidden="true">↗</span></button>
      </form>
      <RouterLink class="login-back" to="/">← Kembali ke situs</RouterLink>
    </section>
  </main>
</template>
