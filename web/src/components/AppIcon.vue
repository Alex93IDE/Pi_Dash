<script setup lang="ts">
import { ref, watch } from "vue";
import type { App } from "../../../shared/types";
import { appIconSrc } from "../utils/apps";

// The app's own icon when the server could find one; its initial otherwise.
const props = withDefaults(defineProps<{ app: App; size?: number }>(), { size: 36 });

const broken = ref(false);
watch(() => props.app.url, () => (broken.value = false));
</script>

<template>
  <span class="icon" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.42}px` }">
    <img v-if="!broken" :src="appIconSrc(app)" alt="" @error="broken = true" />
    <template v-else>{{ app.name[0]?.toUpperCase() }}</template>
  </span>
</template>

<style scoped>
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
