<script setup lang="ts">
import { computed } from "vue";
import { Cpu, Thermometer, Zap, Wind, Plug } from "lucide-vue-next";
import { powerSummary } from "../utils/power";
import { usePiStore } from "../stores/pi";

const store = usePiStore();

const cpuPct = computed(() => store.fastData.cpu_pct);
const cpuFreq = computed(() => store.fastData.cpu_freq);
const cpuTemp = computed(() => store.fastData.cpu_temp);
const fanRpm = computed(() => store.fastData.fan_rpm);

const freqGHz = computed(() =>
  cpuFreq.value !== null ? (cpuFreq.value / 1000).toFixed(2) : null
);

const tempColor = computed(() => {
  const t = cpuTemp.value;
  if (t === null) return "#525875";
  if (t >= 80) return "#ef4444";
  if (t >= 65) return "#f97316";
  return "#22c55e";
});

const pctColor = computed(() => {
  const p = cpuPct.value;
  if (p === null) return "#525875";
  if (p >= 90) return "#ef4444";
  if (p >= 70) return "#f97316";
  return "#22c55e";
});

const cores = computed(() => store.fastData.cpu_cores ?? []);
const loadAvg = computed(() => store.fastData.load_avg);

function pctToColor(p: number): string {
  if (p >= 90) return "#ef4444";
  if (p >= 70) return "#f97316";
  return "#22c55e";
}

// Load is only meaningful relative to the core count: 4.0 on a 4-core Pi
// means every core busy.
function loadColor(load: number): string {
  const perCore = load / (cores.value.length || 4);
  if (perCore >= 1) return "#ef4444";
  if (perCore >= 0.7) return "#f97316";
  return "#a6adc8";
}

const LOAD_LABELS = ["1m", "5m", "15m"];

// null off a Pi (no vcgencmd): the row is hidden.
const power = computed(() => {
  const p = store.slowData.power;
  return p ? { ...powerSummary(p), volts: p.volts } : null;
});

const CIRC = 2 * Math.PI * 52;
const pctDash = computed(() => {
  const filled = ((cpuPct.value ?? 0) / 100) * CIRC;
  return `${filled} ${CIRC}`;
});
</script>

<template>
  <div class="card">
    <div class="card-header">
      <Cpu :size="16" />
      <span>CPU</span>
    </div>

    <div class="card-body">
      <div class="gauge-wrap">
        <svg class="gauge" viewBox="0 0 120 120">
          <defs>
            <filter id="glow-cpu" x="-50%" y="-50%" width="200%" height="200%">
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
            filter="url(#glow-cpu)"
          />
        </svg>
        <div class="gauge-label">
          <span class="gauge-value" :style="{ color: pctColor }">
            {{ cpuPct !== null ? cpuPct.toFixed(0) : "—" }}
          </span>
          <span class="gauge-unit" :style="{ color: pctColor }">%</span>
        </div>
      </div>

      <div class="metrics">
        <div class="metric">
          <Thermometer :size="14" :style="{ color: tempColor }" />
          <div class="metric-content">
            <span class="metric-label">Temp</span>
            <span class="metric-value" :style="{ color: tempColor }">
              {{ cpuTemp !== null ? `${cpuTemp.toFixed(1)}°` : "—" }}
            </span>
          </div>
        </div>
        <div class="metric">
          <Zap :size="14" style="color: #a78bfa" />
          <div class="metric-content">
            <span class="metric-label">Freq</span>
            <span class="metric-value" style="color: #a78bfa">
              {{ freqGHz !== null ? `${freqGHz}G` : "—" }}
            </span>
          </div>
        </div>
        <div class="metric">
          <Wind :size="14" style="color: #38bdf8" />
          <div class="metric-content">
            <span class="metric-label">Fan</span>
            <span class="metric-value" style="color: #38bdf8">
              {{ fanRpm !== null ? `${fanRpm}` : "—" }}
            </span>
          </div>
        </div>
      </div>

      <div class="extra">
        <div v-if="cores.length" class="cores">
          <div v-for="(pct, i) in cores" :key="i" class="core">
            <div class="core-bar">
              <div
                class="core-fill"
                :style="{ height: `${Math.min(pct, 100)}%`, background: pctToColor(pct) }"
              />
            </div>
            <span class="core-label">C{{ i }}</span>
          </div>
        </div>
        <div class="load">
          <span class="load-title">Load</span>
          <div v-for="(label, i) in LOAD_LABELS" :key="label" class="load-item">
            <span
              class="load-value"
              :style="{ color: loadAvg ? loadColor(loadAvg[i]) : '#525875' }"
            >
              {{ loadAvg ? loadAvg[i].toFixed(2) : "—" }}
            </span>
            <span class="load-label">{{ label }}</span>
          </div>
        </div>
      </div>

      <div v-if="power" class="power" title="Power supply, from vcgencmd get_throttled">
        <Plug :size="14" :style="{ color: power.color }" />
        <span class="power-label">Power</span>
        <span v-if="power.volts !== null" class="power-volts">{{ power.volts.toFixed(2) }} V</span>
        <span class="power-state" :style="{ color: power.color, borderColor: power.color }">{{ power.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  border-color: rgba(34, 197, 94, 0.15);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 0 32px rgba(34, 197, 94, 0.06), 0 12px 40px rgba(0, 0, 0, 0.6);
}

/* Power supply */
.power {
  align-self: stretch; /* the card body centers its children */
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.055);
}

.power-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.power-volts {
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--text);
}

.power-state {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid;
  font-size: 10px;
  font-weight: 600;
  font-family: var(--font-mono);
  white-space: nowrap;
}

/* Per-core bars and load average */
.extra {
  display: flex;
  align-items: stretch;
  gap: 7px;
  width: 100%;
}

.cores,
.load {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.055);
}

.cores {
  flex-shrink: 0;
}

.core {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.core-bar {
  position: relative;
  width: 8px;
  height: 30px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.core-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 4px;
  transition: height 0.5s cubic-bezier(0.4, 0, 0.2, 1), background 0.5s ease;
}

.core-label,
.load-label,
.load-title {
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(107, 112, 144, 0.7);
}

.load {
  flex: 1;
  justify-content: space-between;
  align-items: center;
}

.load-title {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}

.load-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.load-value {
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-mono);
  line-height: 1;
}
</style>
