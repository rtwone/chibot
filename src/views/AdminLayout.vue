<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api, setCsrfToken } from "../api.js";

const router = useRouter();
const username = ref("Admin");
const error = ref("");
const busy = ref(false);
const links = [
  ["dashboard", "⌂", "Ringkasan", "/admin/dashboard"],
  ["settings", "⚙", "Pengaturan situs", "/admin/settings"],
  ["commands", "⌘", "Perintah", "/admin/commands"],
  ["faqs", "?", "FAQ", "/admin/faqs"],
  ["contacts", "↗", "Kontak", "/admin/contacts"],
  ["appearance", "◐", "Tampilan", "/admin/appearance"],
  ["profile", "◎", "Profil admin", "/admin/profile"],
];

onMounted(async () => {
  try {
    const session = await api("/api/admin/session");
    if (!session.authenticated) return router.replace("/admin");
    username.value = session.admin.username;
    setCsrfToken(session.csrfToken);
  } catch (cause) {
    error.value = cause.message;
  }
});

async function logout() {
  busy.value = true;
  try {
    await api("/api/admin/logout", { method: "POST" });
    setCsrfToken("");
    await router.replace("/admin");
  } catch (cause) {
    error.value = cause.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="admin-body">
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <RouterLink class="brand" to="/admin/dashboard"><span class="brand-mark">✳</span><span>Chibot <small>STUDIO</small></span></RouterLink>
        <p class="sidebar-label">PENGELOLAAN</p>
        <nav>
          <RouterLink v-for="[key, icon, label, href] in links" :key="key" class="sidebar-link" :class="{ 'is-active': $route.path === href }" :to="href"><span>{{ icon }}</span>{{ label }}</RouterLink>
        </nav>
        <div class="sidebar-bottom">
          <RouterLink to="/" class="sidebar-link"><span>↖</span>Lihat situs</RouterLink>
          <button class="sidebar-link sidebar-logout" :disabled="busy" @click="logout"><span>↪</span>{{ busy ? "Keluar..." : "Keluar" }}</button>
        </div>
      </aside>
      <div class="admin-main">
        <header class="admin-topbar"><span class="admin-breadcrumb">ADMIN / <strong>{{ $route.path.split("/").pop().toUpperCase() }}</strong></span><span class="admin-user"><span class="admin-avatar">{{ username.slice(0, 1).toUpperCase() }}</span>{{ username }}</span></header>
        <main class="admin-content">
          <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
          <RouterView />
        </main>
      </div>
    </div>
  </div>
</template>
