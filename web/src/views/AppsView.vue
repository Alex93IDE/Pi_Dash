<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { Check, ExternalLink, LayoutGrid, Pencil, Plus, Trash2, X } from "lucide-vue-next";
import { api } from "../composables/api";
import type { App, AppInput } from "../../../shared/types";

const apps = ref<App[] | null>(null);
const loadError = ref<string | null>(null);
const editing = ref(false);

async function load() {
  try {
    apps.value = await api<App[]>("GET", "/apps");
    loadError.value = null;
  } catch (e) {
    loadError.value = (e as Error).message;
  }
}
onMounted(load);

/** {host} becomes whatever host this dashboard was opened on. */
const resolve = (url: string) => url.replaceAll("{host}", window.location.hostname);

function hostOf(url: string) {
  try {
    return new URL(resolve(url)).host;
  } catch {
    return url;
  }
}

// The app's own favicon when it has one; its initial otherwise.
const brokenIcons = reactive(new Set<number>());
function iconUrl(url: string) {
  try {
    return new URL("/favicon.ico", resolve(url)).href;
  } catch {
    return "";
  }
}

// ── Add / edit form ──────────────────────────────────────
// id null = adding a new one.
const form = ref<(AppInput & { id: number | null }) | null>(null);
const formError = ref<string | null>(null);
const saving = ref(false);

function startAdd() {
  form.value = { id: null, name: "", url: "http://{host}:", description: "" };
  formError.value = null;
}

function startEdit(app: App) {
  form.value = { ...app };
  formError.value = null;
}

async function save() {
  if (!form.value || saving.value) return;
  const { id, ...input } = form.value;
  saving.value = true;
  try {
    if (id === null) await api("POST", "/apps", input);
    else await api("PUT", `/apps/${id}`, input);
    form.value = null;
    await load();
  } catch (e) {
    formError.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

async function remove(app: App) {
  if (!window.confirm(`Remove ${app.name}?`)) return;
  try {
    await api("DELETE", `/apps/${app.id}`);
    await load();
  } catch (e) {
    window.alert(`Could not remove it: ${(e as Error).message}`);
  }
}

function toggleEditing() {
  editing.value = !editing.value;
  form.value = null;
}
</script>

<template>
  <div class="page">
    <div class="card apps-card">
      <div class="card-header">
        <LayoutGrid :size="16" />
        <span>Apps</span>
        <button type="button" class="edit-toggle" :class="{ active: editing }" @click="toggleEditing">
          <component :is="editing ? Check : Pencil" :size="12" />
          {{ editing ? "Done" : "Edit" }}
        </button>
      </div>

      <form v-if="form" class="form" @submit.prevent="save">
        <label>
          <span>Name</span>
          <input v-model="form.name" type="text" maxlength="60" placeholder="WGDashboard" required />
        </label>
        <label>
          <span>URL</span>
          <input v-model="form.url" type="text" placeholder="http://{host}:10086" required />
          <small><code>{host}</code> is replaced with the address you opened this dashboard on.</small>
        </label>
        <label>
          <span>Description <em>(optional)</em></span>
          <input v-model="form.description" type="text" maxlength="200" placeholder="WireGuard peers" />
        </label>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="form-buttons">
          <button type="button" class="btn" @click="form = null"><X :size="13" /> Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <Check :size="13" /> {{ form.id === null ? "Add" : "Save" }}
          </button>
        </div>
      </form>

      <div v-if="loadError" class="empty">Could not load apps: {{ loadError }}</div>
      <div v-else-if="apps === null" class="empty">Loading…</div>
      <div v-else-if="!apps.length && !editing" class="empty">
        No apps yet. Use <b>Edit</b> to add links to things running on your Pi.
      </div>

      <ul v-if="apps" class="grid">
        <li v-for="app in apps" :key="app.id" class="tile-wrap">
          <a class="tile" :href="resolve(app.url)" target="_blank" rel="noopener noreferrer">
            <span class="icon">
              <img
                v-if="!brokenIcons.has(app.id) && iconUrl(app.url)"
                :src="iconUrl(app.url)"
                alt=""
                @error="brokenIcons.add(app.id)"
              />
              <template v-else>{{ app.name[0]?.toUpperCase() }}</template>
            </span>
            <span class="info">
              <span class="name">{{ app.name }}</span>
              <span class="desc">{{ app.description || hostOf(app.url) }}</span>
            </span>
            <ExternalLink v-if="!editing" :size="13" class="go" />
          </a>
          <div v-if="editing" class="tile-actions">
            <button type="button" title="Edit" @click="startEdit(app)"><Pencil :size="12" /></button>
            <button type="button" title="Remove" class="danger" @click="remove(app)"><Trash2 :size="12" /></button>
          </div>
        </li>
        <li v-if="editing && !form">
          <button type="button" class="tile add" @click="startAdd"><Plus :size="16" /> Add app</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.apps-card {
  width: 100%;
  max-width: 1100px;
}

.edit-toggle {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: transparent;
  color: var(--text-muted);
  font: 600 11px var(--font-sans);
  text-transform: none;
  letter-spacing: 0;
  cursor: pointer;
}

.edit-toggle:hover {
  color: var(--text);
}

.edit-toggle.active {
  color: var(--primary);
  border-color: var(--primary);
  background: var(--primary-muted);
}

/* Grid of tiles */
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px;
}

.tile-wrap {
  position: relative;
}

.tile {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 100%;
  padding: 12px 14px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.2s, background 0.2s;
}

a.tile:hover {
  border-color: rgba(4, 145, 115, 0.5);
  background: rgba(4, 145, 115, 0.06);
}

.icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--primary-muted);
  color: var(--primary);
  font: 600 15px var(--font-sans);
  overflow: hidden;
}

.icon img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desc {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.go {
  flex-shrink: 0;
  color: var(--text-dim);
}

a.tile:hover .go {
  color: var(--primary);
}

.tile-actions {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  display: flex;
  gap: 4px;
}

.tile-actions button {
  display: flex;
  padding: 6px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: var(--bg-elevated);
  color: var(--text-muted);
  cursor: pointer;
}

.tile-actions button:hover {
  color: var(--text);
}

.tile-actions .danger:hover {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.4);
}

.add {
  justify-content: center;
  min-height: 62px;
  border-style: dashed;
  color: var(--text-muted);
  font: 600 12px var(--font-sans);
  cursor: pointer;
}

.add:hover {
  color: var(--primary);
  border-color: var(--primary);
}

/* Form */
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 18px;
  padding: 14px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--border);
}

.form label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}

.form em {
  font-style: normal;
  font-weight: 400;
}

.form input {
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.07);
  color: var(--text);
  font: 12.5px var(--font-mono);
  outline: none;
}

.form input:focus {
  border-color: var(--primary);
}

.form small {
  font-weight: 400;
  font-size: 10.5px;
}

.form-error {
  font-size: 11.5px;
  color: #ef4444;
}

.form-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  color: var(--text-muted);
  font: 600 11.5px var(--font-sans);
  cursor: pointer;
}

.btn:hover {
  color: var(--text);
}

.btn-primary {
  color: var(--primary);
  border-color: var(--primary);
  background: var(--primary-muted);
}

.btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.empty {
  color: var(--text-muted);
  font-size: 13px;
  padding: 20px 0;
  text-align: center;
}
</style>
