<script setup lang="ts">
import { computed } from "vue";
import { MemoryStick, Database } from "lucide-vue-next";
import { usePiStore } from "../stores/pi";
import Sparkline from "./Sparkline.vue";

const store = usePiStore();

const ramPct = computed(() => store.fastData.ram_pct);
const ramUsed = computed(() => store.fastData.ram_used);
const ramTotal = computed(() => store.fastData.ram_total);

const usedGB = computed(() =>
  ramUsed.value !== null ? (ramUsed.value / 1024).toFixed(2) : null
);
const totalGB = computed(() =>
  ramTotal.value !== null ? (ramTotal.value / 1024).toFixed(2) : null
);

const pctColor = computed(() => {
  const p = ramPct.value;
  if (p === null) return "#525875";
  if (p >= 90) return "#ef4444";
  if (p >= 70) return "#f97316";
  return "#74c7ec";
});

// Scale the graph to the last minute rather than 0–100 %, like the network
// one, so small changes are visible. Edges are rounded to one decimal with
// half a point of margin, and the range is at least 2 points tall so a flat
// line doesn't turn noise into cliffs.
const round1 = (v: number) => Math.round(v * 10) / 10;

const chartScale = computed(() => {
  const h = store.ramHistory;
  if (!h.length) return { min: 0, max: 100 };
  let min = Math.min(...h) - 0.5;
  let max = Math.max(...h) + 0.5;
  if (max - min < 2) {
    const mid = (max + min) / 2;
    min = mid - 1;
    max = mid + 1;
  }
  return { min: round1(Math.max(0, min)), max: round1(Math.min(100, max)) };
});

const CIRC = 2 * Math.PI * 52;
const pctDash = computed(() => {
  const filled = ((ramPct.value ?? 0) / 100) * CIRC;
  return `${filled} ${CIRC}`;
});
</script>

<template>
  <div class="card">
    <div class="card-header">
      <MemoryStick :size="16" />
      <span>RAM</span>
    </div>

    <div class="card-body">
      <div class="gauge-wrap">
        <svg class="gauge" viewBox="0 0 120 120">
          <defs>
            <filter id="glow-ram" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="60" cy="60" r="52" class="gauge-bg" />
          <circle
            cx="60"
            cy="60"
            r="52"
            class="gauge-fill"
            :stroke="pctColor"
            :stroke-dasharray="pctDash"
            stroke-dashoffset="0"
            transform="rotate(-90 60 60)"
            filter="url(#glow-ram)"
          />
        </svg>
        <div class="gauge-label">
          <span class="gauge-value" :style="{ color: pctColor }">
            {{ ramPct !== null ? ramPct.toFixed(0) : "—" }}
          </span>
          <span class="gauge-unit" :style="{ color: pctColor }">%</span>
        </div>
      </div>

      <div class="metrics">
        <div class="metric">
          <Database :size="14" :style="{ color: pctColor }" />
          <div class="metric-content">
            <span class="metric-label">Used</span>
            <span class="metric-value" :style="{ color: pctColor }">
              {{ usedGB !== null ? `${usedGB}G` : "—" }}
            </span>
          </div>
        </div>
        <div class="metric">
          <MemoryStick :size="14" style="color: rgba(116, 199, 236, 0.45)" />
          <div class="metric-content">
            <span class="metric-label">Total</span>
            <span class="metric-value" style="color: rgba(116, 199, 236, 0.6)">
              {{ totalGB !== null ? `${totalGB}G` : "—" }}
            </span>
          </div>
        </div>
      </div>

      <Sparkline
        :series="[{ values: store.ramHistory, color: pctColor, fill: true }]"
        :min="chartScale.min"
        :max="chartScale.max"
        :top-label="`${chartScale.max.toFixed(1)} %`"
        :bottom-label="`${chartScale.min.toFixed(1)} %`"
      />
    </div>
  </div>
</template>

<style scoped>
.card {
  border-color: rgba(116, 199, 236, 0.15);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 0 32px rgba(116, 199, 236, 0.06), 0 12px 40px rgba(0, 0, 0, 0.6);
}
</style>
