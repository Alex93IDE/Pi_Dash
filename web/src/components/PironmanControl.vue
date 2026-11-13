<script setup lang="ts">
import { ref, watch } from "vue";
import { Monitor, Lightbulb, Wind, Sun, Palette, Zap } from "lucide-vue-next";
import { useApi } from "../composables/api";
import { usePiStore } from "../stores/pi";

const { sendPironman } = useApi();
const store = usePiStore();

// Sync local refs from store on first data arrival
const localColor = ref(store.fastData.rgb_color ?? "#ffffff");
const localBrightness = ref(store.fastData.rgb_brightness ?? 50);
const localStyle = ref(store.fastData.rgb_style ?? "solid");

watch(
  () => store.fastData.rgb_color,
  (v) => {
    if (v) localColor.value = v;
  }
);
watch(
  () => store.fastData.rgb_brightness,
  (v) => {
    if (v !== null) localBrightness.value = v;
  }
);
watch(
  () => store.fastData.rgb_style,
  (v) => {
    if (v) localStyle.value = v;
  }
);

const oledOn = () => store.fastData.oled_enable ?? false;
const rgbOn = () => store.fastData.rgb_enable ?? false;
const fanMode = () => store.fastData.fan_mode;

const STYLES = [
  { value: "solid", label: "Solid" },
  { value: "breathing", label: "Breathing" },
  { value: "flow", label: "Flow" },
  { value: "flow_reverse", label: "Flow Reverse" },
  { value: "rainbow", label: "Rainbow" },
  { value: "rainbow_reverse", label: "Rainbow Reverse" },
  { value: "hue_cycle", label: "Hue Cycle" },
];

function toggleOled() {
  sendPironman({ action: oledOn() ? "oled_off" : "oled_on" });
}

function toggleRgb() {
  sendPironman({ action: rgbOn() ? "rgb_off" : "rgb_on" });
}

function toggleFan() {
  sendPironman({ action: "fan_mode", mode: fanMode() === 0 ? 1 : 0 });
}

function sendColor() {
  sendPironman({ action: "rgb_color", color: localColor.value });
}

function sendStyle() {
  sendPironman({ action: "rgb_style", style: localStyle.value });
}

function sendBrightness() {
  sendPironman({
    action: "rgb_brightness",
    value: Number(localBrightness.value),
  });
}
</script>

<template>
  <div class="card">
    <div class="card-header">
      <Lightbulb :size="16" />
      <span>Pironman</span>
    </div>

    <div class="card-body">
      <!-- Fila 1: OLED + RGB toggles -->
      <div class="toggle-row">
        <div class="toggle-chip" @click="toggleOled">
          <Monitor
            :size="13"
            :style="{ color: oledOn() ? '#e2e4ef' : '#525875' }"
          />
          <span class="chip-label" :class="{ active: oledOn() }">OLED</span>
          <div class="toggle" :class="{ on: oledOn() }">
            <span class="toggle-thumb" />
          </div>
        </div>
        <div class="toggle-chip" @click="toggleRgb">
          <Lightbulb
            :size="13"
            :style="{ color: rgbOn() ? '#a78bfa' : '#525875' }"
          />
          <span class="chip-label" :class="{ active: rgbOn() }">RGB</span>
          <div class="toggle" :class="{ on: rgbOn() }">
            <span class="toggle-thumb" />
          </div>
        </div>
      </div>

      <!-- Fila 2: Color + Style -->
      <div class="two-col">
        <div class="ctrl-block">
          <span class="block-label"><Palette :size="11" /> Color</span>
          <input
            type="color"
            v-model="localColor"
            class="color-picker"
            @change="sendColor"
          />
        </div>
        <div class="ctrl-block">
          <span class="block-label"><Zap :size="11" /> Style</span>
          <select v-model="localStyle" class="select" @change="sendStyle">
            <option v-for="s in STYLES" :key="s.value" :value="s.value">
              {{ s.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- Fila 3: Brightness -->
      <div class="brightness-row">
        <span class="block-label"><Sun :size="11" /> Brightness</span>
        <div class="slider-wrap">
          <input
            type="range"
            min="0"
            max="100"
            v-model="localBrightness"
            class="slider"
            @change="sendBrightness"
          />
          <span class="slider-val">{{ localBrightness }}%</span>
        </div>
      </div>

      <div class="h-divider" />

      <!-- Fila 4: Fan -->
      <div class="control-row" @click="toggleFan">
        <div class="ctrl-left">
          <Wind :size="14" style="color: #38bdf8" />
          <span class="chip-label active">Fan</span>
          <span></span>
        </div>
        <div class="fan-toggle">
          <span :class="fanMode() === 0 ? 'fan-active' : 'fan-inactive'"
            >On</span
          >
          <span class="fan-sep">/</span>
          <span :class="fanMode() === 1 ? 'fan-active' : 'fan-inactive'"
            >Auto</span
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  height: 280px;
  border-color: rgba(167, 139, 250, 0.15);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 0 32px rgba(167, 139, 250, 0.06), 0 12px 40px rgba(0, 0, 0, 0.6);
}

.card-body {
  width: 100%;
  gap: 8px;
}

.h-divider {
  width: 100%;
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 2px 0;
}

/* Fila OLED + RGB */
.toggle-row {
  display: flex;
  gap: 8px;
}

.toggle-chip {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 11px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.toggle-chip:hover {
  background: rgba(255, 255, 255, 0.06);
}
.toggle-chip:active {
  transform: scale(0.98);
}

.chip-label {
  font-size: 12px;
  font-weight: 600;
  color: #525875;
  flex: 1;
  transition: color 0.2s;
}

.chip-label.active {
  color: var(--text);
}

/* Fila Color + Style */
.two-col {
  display: flex;
  gap: 8px;
}

.ctrl-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.block-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(107, 112, 144, 0.7);
}

/* Brightness row */
.brightness-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* Fan row */
.control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 11px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
}

.control-row:hover {
  background: rgba(255, 255, 255, 0.06);
}
.control-row:active {
  transform: scale(0.99);
}

.ctrl-left {
  display: flex;
  align-items: center;
  gap: 7px;
}

/* Toggle pill */
.toggle {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  transition: background 0.25s, border-color 0.25s;
  flex-shrink: 0;
}

.toggle.on {
  background: rgba(167, 139, 250, 0.3);
  border-color: rgba(167, 139, 250, 0.5);
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #525875;
  transition: transform 0.25s, background 0.25s;
}

.toggle.on .toggle-thumb {
  transform: translateX(16px);
  background: #a78bfa;
}

/* Color picker */
.color-picker {
  width: 36px;
  height: 26px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  cursor: pointer;
  padding: 2px;
  flex-shrink: 0;
}

/* Style select */
.select {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: var(--text);
  font-size: 11px;
  padding: 5px 7px;
  cursor: pointer;
  outline: none;
  font-family: var(--font-mono);
}

.select option {
  background: #1a1c26;
}

/* Brightness slider */
.slider-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.slider {
  flex: 1;
  accent-color: #a78bfa;
  cursor: pointer;
}

.slider-val {
  font-size: 11px;
  font-family: var(--font-mono);
  color: #a78bfa;
  min-width: 30px;
  text-align: right;
}

/* Fan */
.fan-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 600;
}

.fan-sep {
  color: #525875;
}
.fan-active {
  color: #38bdf8;
}
.fan-inactive {
  color: #525875;
}
</style>
