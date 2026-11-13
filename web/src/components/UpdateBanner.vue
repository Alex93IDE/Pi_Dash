<script setup lang="ts">
import { Download, RefreshCw, X } from "lucide-vue-next";
import { applyUpdate, dismissUpdate, updateVisible, updating } from "../pwa";
</script>

<template>
  <Transition name="update-slide">
    <div v-if="updateVisible" class="update-banner" role="dialog" aria-label="New version available">
      <span class="icon"><Download :size="18" /></span>

      <div class="text">
        <span class="title">New version available</span>
        <span class="subtitle">Reload to start using it.</span>
      </div>

      <button type="button" class="apply" :disabled="updating" @click="applyUpdate">
        <RefreshCw :size="13" :class="{ spinning: updating }" />
        {{ updating ? "Updating…" : "Update" }}
      </button>
      <button
        type="button"
        class="close"
        aria-label="Not now"
        :disabled="updating"
        @click="dismissUpdate"
      >
        <X :size="15" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.update-banner {
  position: fixed;
  left: 50%;
  bottom: max(16px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 100;
  width: calc(100% - 24px);
  max-width: 460px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 16px;
  background: var(--bg-elevated);
  border: 1px solid rgba(4, 145, 115, 0.35);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
}

.icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--primary-muted);
  color: var(--primary);
}

.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.subtitle {
  font-size: 11px;
  color: var(--text-muted);
}

.apply,
.close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  border: none;
  cursor: pointer;
}

.apply {
  gap: 6px;
  padding: 7px 14px;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  font: 600 12px var(--font-sans);
  transition: background 0.2s;
}

.apply:hover:not(:disabled) {
  background: var(--primary-hover);
}

.close {
  padding: 6px;
  border-radius: 50%;
  background: none;
  color: var(--text-muted);
}

.close:hover:not(:disabled) {
  color: var(--text);
}

.apply:disabled,
.close:disabled {
  cursor: wait;
  opacity: 0.7;
}

.spinning {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.update-slide-enter-active,
.update-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.update-slide-enter-from,
.update-slide-leave-to {
  transform: translate(-50%, 120%);
  opacity: 0;
}
</style>
