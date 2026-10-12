<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { api } from "../api.js";

const props = defineProps({ table: { type: String, required: true } });
const config = {
  features: { title: "Fitur", noun: "fitur", columns: [["title", "Judul"], ["description", "Deskripsi"], ["sort_order", "Urutan"], ["is_visible", "Tampil"]], fields: [["title", "Judul", true], ["description", "Deskripsi", true, true], ["icon", "Ikon", true]] },
  commands: { title: "Perintah", noun: "perintah", columns: [["command", "Perintah"], ["category", "Kategori"], ["sort_order", "Urutan"], ["is_visible", "Tampil"]], fields: [["command", "Perintah", true], ["description", "Deskripsi", true, true], ["category", "Kategori", true], ["usage_example", "Contoh penggunaan", false]] },
  faqs: { title: "FAQ", noun: "FAQ", columns: [["question", "Pertanyaan"], ["answer", "Jawaban"], ["sort_order", "Urutan"], ["is_visible", "Tampil"]], fields: [["question", "Pertanyaan", true], ["answer", "Jawaban", true, true]] },
  contacts: { title: "Kontak", noun: "kontak", columns: [["label", "Label"], ["type", "Jenis"], ["value", "Nilai"], ["sort_order", "Urutan"], ["is_visible", "Tampil"]], fields: [["label", "Label", true], ["type", "Jenis kontak", true], ["value", "Nilai tampilan", true], ["url", "URL HTTPS", false]] },
};
const itemConfig = computed(() => config[props.table]);
const items = ref([]);
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const search = ref("");
const editorOpen = ref(false);
const editingId = ref("");
const form = reactive({});
let searchTimer;

const blankForm = () => {
  Object.keys(form).forEach((key) => delete form[key]);
  for (const [key] of itemConfig.value.fields) form[key] = "";
  form.sort_order = 0;
  form.is_visible = true;
};

async function loadItems() {
  loading.value = true;
  error.value = "";
  try {
    const result = await api(`/api/admin/content/${props.table}?search=${encodeURIComponent(search.value)}`);
    items.value = result.items;
  } catch (cause) {
    error.value = cause.message;
  } finally {
    loading.value = false;
  }
}

function newItem() {
  editingId.value = "";
  blankForm();
  editorOpen.value = true;
}

function editItem(item) {
  editingId.value = item.id;
  blankForm();
  Object.assign(form, item);
  editorOpen.value = true;
}

async function saveItem() {
  saving.value = true;
  error.value = "";
  try {
    const path = `/api/admin/content/${props.table}${editingId.value ? `/${encodeURIComponent(editingId.value)}` : ""}`;
    await api(path, { method: editingId.value ? "PUT" : "POST", body: JSON.stringify(form) });
    editorOpen.value = false;
    await loadItems();
  } catch (cause) {
    error.value = cause.message;
  } finally {
    saving.value = false;
  }
}

async function deleteItem(item) {
  if (!window.confirm(`Hapus ${itemConfig.value.noun} ini? Tindakan ini tidak dapat dibatalkan.`)) return;
  error.value = "";
  try {
    await api(`/api/admin/content/${props.table}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    await loadItems();
  } catch (cause) {
    error.value = cause.message;
  }
}

watch(() => props.table, () => {
  editorOpen.value = false;
  search.value = "";
  loadItems();
});
watch(search, () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(loadItems, 220);
});
onMounted(loadItems);
</script>

<template>
  <div>
    <div class="admin-page-heading admin-title-row"><div><span class="section-kicker">KONTEN SITUS</span><h1>{{ itemConfig.title }}</h1></div><button class="button button-dark" type="button" @click="newItem">Tambah {{ itemConfig.noun }} <span aria-hidden="true">＋</span></button></div>
    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>

    <section v-if="editorOpen" class="admin-card resource-form resource-editor">
      <div class="admin-card-heading"><div><span class="section-kicker">{{ editingId ? "UBAH KONTEN" : "KONTEN BARU" }}</span><h2>{{ editingId ? `Edit ${itemConfig.noun}` : `Tambah ${itemConfig.noun}` }}</h2></div></div>
      <form @submit.prevent="saveItem">
        <div class="settings-grid">
          <label v-for="[key, label, required, multiline] in itemConfig.fields" :key="key" class="form-field">
            <span>{{ label }}</span>
            <textarea v-if="multiline" v-model="form[key]" rows="4" maxlength="1000" :required="required"></textarea>
            <input v-else v-model="form[key]" :required="required" :maxlength="key === 'icon' ? 12 : 500">
          </label>
          <label class="form-field"><span>Urutan tampil</span><input v-model.number="form.sort_order" type="number" min="0" max="9999"></label>
          <label class="check-field"><input v-model="form.is_visible" type="checkbox"><span>Tampilkan di situs</span></label>
        </div>
        <div class="admin-form-actions"><button class="button button-dark" type="submit" :disabled="saving">{{ saving ? "Menyimpan..." : "Simpan" }}</button><button class="button button-outline" type="button" @click="editorOpen = false">Batal</button></div>
      </form>
    </section>

    <section class="admin-card data-card">
      <div class="table-toolbar">
        <label class="table-search"><input v-model="search" type="search" :placeholder="`Cari ${itemConfig.title.toLocaleLowerCase()}...`" :aria-label="`Cari ${itemConfig.title.toLocaleLowerCase()}`"></label>
        <span>{{ items.length }} entri</span>
      </div>
      <p v-if="loading" class="loading-state">Memuat konten...</p>
      <div v-else-if="items.length" class="table-scroll">
        <table>
          <thead><tr><th v-for="[key, label] in itemConfig.columns" :key="key">{{ label }}</th><th>Aksi</th></tr></thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td v-for="[key] in itemConfig.columns" :key="key">
                <span v-if="key === 'is_visible'" class="visibility-tag" :class="{ visible: item[key] }">{{ item[key] ? "Tampil" : "Tersembunyi" }}</span>
                <template v-else>{{ String(item[key] ?? "").slice(0, 140) }}</template>
              </td>
              <td><div class="row-actions"><button type="button" @click="editItem(item)">Ubah</button><button class="delete-link" type="button" @click="deleteItem(item)">Hapus</button></div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="admin-empty"><span>✳</span><h2>{{ search ? "Tidak ada hasil." : "Belum ada konten." }}</h2><p>{{ search ? "Coba kata pencarian lain." : "Tambahkan entri pertama untuk memulai." }}</p></div>
    </section>
  </div>
</template>
