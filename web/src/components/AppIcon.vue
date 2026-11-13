<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { App } from "../../../shared/types";
import { appIconSrc } from "../utils/apps";
import { usePiStore } from "../stores/pi";

// The app's own icon when the server could find one; its initial otherwise.
// A dot in the corner says whether it answered the server's last check.
const props = withDefaults(defineProps<{ app: App; size?: number }>(), { size: 36 });

const store = usePiStore();
const broken = ref(false);
watch(() => props.app.url, () => (broken.value = false));

const status = computed(() => store.appStatus[props.app.id]);
const statusTitle = computed(() => {
  const s = status.value;
  if (!s) return "Not checked yet";
  return s.up ? `Up · ${s.ms} ms` : `Down · ${s.error}`;
});
</script>

<template>
  <span class="wrap" :title="statusTitle">
    <span class="icon" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.42}px` }">
      <img v-if="!broken" :src="appIconSrc(app)" alt="" @error="broken = true" />
      <template v-else>{{ app.name[0]?.toUpperCase() }}</template>
    </span>
    <span class="status" :class="status ? (status.up ? 'up' : 'down') : 'unknown'" />
  </span>
</template>

<style scoped>
.wrap {
  position: relative;
  flex-shrink: 0;
  display: flex;
}

.status {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--bg-surface);
}

.status.up { background: #22c55e; }
.status.down { background: #ef4444; box-shadow: 0 0 0 2px var(--bg-surface), 0 0 6px rgba(239, 68, 68, 0.6); }
.status.unknown { background: #525875; }

.icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--primary-muted);
  color: var(--primary);
  font-weight: 600;
  overflow: hidden;
}

.icon:has(img) {
  background: rgba(255, 255, 255, 0.05);
}

.icon img {
  width: 66%;
  height: 66%;
  object-fit: contain;
}
</style>
