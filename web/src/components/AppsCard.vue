<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { LayoutGrid, Settings2 } from "lucide-vue-next";
import AppIcon from "./AppIcon.vue";
import { api } from "../composables/api";
import { resolveAppUrl } from "../utils/apps";
import type { App } from "../../../shared/types";

// Quick launch on Home. Adding and editing happens on the Apps tab.
const apps = ref<App[]>([]);

onMounted(async () => {
  try {
    apps.value = await api<App[]>("GET", "/apps");
  } catch (e) {
    console.error("Could not load apps:", e);
  }
});
</script>

<template>
  <div v-if="apps.length" class="card apps-card">
    <div class="card-header">
      <LayoutGrid :size="16" />
      <span>Apps</span>
      <RouterLink :to="{ name: 'apps' }" class="manage" title="Manage apps">
        <Settings2 :size="13" />
      </RouterLink>
    </div>
    <div class="launcher">
      <a
        v-for="app in apps"
        :key="app.id"
        class="app"
        :href="resolveAppUrl(app.url)"
        target="_blank"
        rel="noopener noreferrer"
        :title="app.description || app.name"
      >
        <AppIcon :app="app" :size="44" />
        <span class="name">{{ app.name }}</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.manage {
  margin-left: auto;
  display: flex;
  padding: 4px;
  border-radius: 7px;
  color: var(--text-muted);
  transition: color 0.2s;
}

.manage:hover {
  color: var(--primary);
}

.launcher {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 8px;
}

.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 12px 6px 10px;
  border-radius: 13px;
  border: 1px solid transparent;
  color: inherit;
  text-decoration: none;
  transition: background 0.2s, border-color 0.2s;
}

.app:hover {
  background: rgba(4, 145, 115, 0.06);
  border-color: rgba(4, 145, 115, 0.35);
}

.name {
  max-width: 100%;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
