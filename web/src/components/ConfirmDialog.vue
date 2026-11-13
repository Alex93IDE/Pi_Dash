<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { KeyRound, TriangleAlert } from "lucide-vue-next";
import { dialog } from "../composables/dialog";

const pin = ref("");
const pinInput = ref<HTMLInputElement | null>(null);
const confirmButton = ref<HTMLButtonElement | null>(null);

// Focus what you'd act on next: the PIN field, or the confirm button so
// Enter confirms and Esc cancels without reaching for the mouse.
watch(
  () => dialog.current,
  async (req) => {
    pin.value = "";
    if (!req) return;
    await nextTick();
    (req.pin ? pinInput.value : confirmButton.value)?.focus();
  },
);

function confirm() {
  const req = dialog.current;
  if (!req || (req.pin && !pin.value)) return;
  req.resolve(req.pin ? pin.value : "ok");
}

function cancel() {
  dialog.current?.resolve(null);
}
</script>

<template>
  <Transition name="fade">
    <div v-if="dialog.current" class="backdrop" @click.self="cancel" @keydown.esc="cancel">
      <form
        class="dialog"
        :class="`tone-${dialog.current.tone}`"
        role="alertdialog"
        aria-modal="true"
        :aria-label="dialog.current.title"
        @submit.prevent="confirm"
      >
        <div class="head">
          <span class="icon">
            <KeyRound v-if="dialog.current.pin" :size="16" />
            <TriangleAlert v-else :size="16" />
          </span>
          <h2>{{ dialog.current.title }}</h2>
        </div>
        <p v-if="dialog.current.message" class="message">{{ dialog.current.message }}</p>
        <input
          v-if="dialog.current.pin"
          ref="pinInput"
          v-model="pin"
          class="pin"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          placeholder="PIN"
        />
        <p v-if="dialog.current.error" class="error">{{ dialog.current.error }}</p>
        <div class="buttons">
          <button type="button" class="btn" @click="cancel">Cancel</button>
          <button
            ref="confirmButton"
            type="submit"
            class="btn btn-confirm"
            :disabled="dialog.current.pin && !pin"
          >
            {{ dialog.current.confirmLabel }}
          </button>
        </div>
      </form>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(5, 6, 10, 0.65);
  backdrop-filter: blur(4px);
}

.dialog {
  --tone: var(--primary);
  --tone-muted: var(--primary-muted);
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(26, 28, 40, 0.98) 0%, rgba(19, 20, 30, 0.99) 100%);
  border: 1px solid var(--border);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
}

.tone-danger {
  --tone: #ef4444;
  --tone-muted: rgba(239, 68, 68, 0.14);
  border-color: rgba(239, 68, 68, 0.3);
}

.tone-warn {
  --tone: #f59e0b;
  --tone-muted: rgba(245, 158, 11, 0.14);
  border-color: rgba(245, 158, 11, 0.3);
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon {
  display: flex;
  padding: 7px;
  border-radius: 10px;
  background: var(--tone-muted);
  color: var(--tone);
}

h2 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  overflow-wrap: anywhere;
}

.message {
  font-size: 12.5px;
  line-height: 1.5;
  color: #9aa0bd;
}

.pin {
  padding: 10px 14px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text);
  font: 600 18px var(--font-mono);
  letter-spacing: 0.3em;
  text-align: center;
  outline: none;
}

.pin:focus {
  border-color: var(--primary);
}

.error {
  font-size: 12px;
  color: #ef4444;
}

.buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.btn {
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: #9aa0bd;
  font: 600 12px var(--font-sans);
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}

.btn:hover {
  color: var(--text);
}

.btn-confirm {
  color: var(--tone);
  border-color: var(--tone);
  background: var(--tone-muted);
}

.btn-confirm:hover {
  color: var(--text);
}

.btn-confirm:disabled {
  opacity: 0.4;
  cursor: default;
}

.btn:focus-visible,
.pin:focus-visible {
  outline: 2px solid var(--tone);
  outline-offset: 2px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
