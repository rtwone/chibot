<script setup>
import { onMounted, ref } from "vue";
import { api } from "../api.js";

const summary = ref(null);
const error = ref("");
const loading = ref(true);

onMounted(async () => {
  try {
    summary.value = await api("/api/admin/dashboard");
  } catch (cause) {
    error.value = cause.message;
  } finally {
    loading.value = false;
  }
});

const formatDate = (value) => new Date(value).toLocaleString("id-ID");
</script>

<template>
  <div>
    <div class="admin-page-heading"><div><span class="section-kicker">PENGELOLAAN SITUS</span><h1>Ringkasan</h1></div></div>
    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="loading-state">Memuat data...</p>
    <template v-else>
      <div class="metric-grid">
        <RouterLink v-for="(label, table) in { features: 'Fitur', commands: 'Perintah', faqs: 'FAQ', contacts: 'Kontak' }" :key="table" class="metric-card" :to="`/admin/${table}`"><span>{{ label }}</span><strong>{{ summary.counts[table] }}</strong><small>jumlah entri <span aria-hidden="true">↗</span></small></RouterLink>
      </div>
      <div class="admin-dashboard-grid">
        <section class="admin-card">
          <div class="admin-card-heading"><div><span class="section-kicker">AKSES CEPAT</span><h2>Mulai dari sini.</h2></div></div>
          <div class="quick-actions">
            <RouterLink to="/admin/settings"><span>⚙</span><strong>Ubah pengaturan situs</strong><small>Brand, nomor bot, tautan, dan SEO</small><b>↗</b></RouterLink>
            <RouterLink to="/admin/features"><span>✳</span><strong>Kelola fitur</strong><small>Atur fitur yang ditampilkan</small><b>↗</b></RouterLink>
            <RouterLink to="/admin/commands"><span>⌘</span><strong>Kelola perintah</strong><small>Perbarui daftar perintah</small><b>↗</b></RouterLink>
            <RouterLink to="/admin/appearance"><span>◐</span><strong>Atur tampilan</strong><small>Warna dan tema situs</small><b>↗</b></RouterLink>
          </div>
        </section>
        <aside class="admin-card config-card"><span class="section-kicker">KONFIGURASI BOT</span><h2>Info yang akurat.</h2><p>Situs ini belum terhubung ke status langsung bot. Status hanya berupa catatan yang diatur admin.</p><div class="config-status"><span class="status-dot" :class="{ 'status-muted': !summary.settings.bot_number }"></span>{{ summary.settings.bot_number ? "Nomor sudah diatur" : "Nomor belum diatur" }}</div><RouterLink class="button button-outline" to="/admin/settings">Periksa pengaturan <span aria-hidden="true">↗</span></RouterLink></aside>
      </div>
      <section class="admin-card activity-card">
        <div class="admin-card-heading"><div><span class="section-kicker">LOG AKTIVITAS</span><h2>Aktivitas terbaru</h2></div></div>
        <div v-if="summary.activity.length" class="activity-list"><div v-for="(item, index) in summary.activity" :key="`${item.created_at}-${index}`"><span class="activity-dot"></span><strong>{{ item.action }}</strong><time>{{ formatDate(item.created_at) }}</time></div></div>
        <p v-else class="empty-note">Perubahan admin akan muncul di sini.</p>
      </section>
    </template>
  </div>
</template>
