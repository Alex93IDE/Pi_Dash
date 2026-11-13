<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { ArrowDown, ArrowUp, ChartLine, Cpu, HardDrive, MemoryStick, Thermometer } from "lucide-vue-next";
import HistoryChart, { type ChartPoint } from "../components/HistoryChart.vue";
import { api } from "../composables/api";
import { HISTORY_RANGES, type HistoryPoint, type HistoryRange } from "../../../shared/types";

const MINUTE = 60_000;
// Must match RANGES in server/src/history.ts: [span, bucket].
const RANGE_INFO: Record<HistoryRange, { label: string; span: number; bucket: number }> = {
  "1h": { label: "1 hour", span: 60 * MINUTE, bucket: MINUTE },
  "24h": { label: "24 hours", span: 24 * 60 * MINUTE, bucket: 5 * MINUTE },
  "7d": { label: "7 days", span: 7 * 24 * 60 * MINUTE, bucket: 30 * MINUTE },
  "30d": { label: "30 days", span: 30 * 24 * 60 * MINUTE, bucket: 120 * MINUTE },
};

const range = ref<HistoryRange>("24h");
const points = ref<HistoryPoint[] | null>(null);
const error = ref<string | null>(null);
const now = ref(Date.now());

async function load() {
  try {
    const data = await api<HistoryPoint[]>("GET", `/history?range=${range.value}`);
    points.value = data;
    now.value = Date.now();
    error.value = null;
  } catch (e) {
    error.value = (e as Error).message;
  }
}

watch(range, () => {
  points.value = null;
  void load();
});

// A new row lands every minute.
let timer: ReturnType<typeof setInterval>;
onMounted(() => {
  void load();
  timer = setInterval(load, MINUTE);
});
onUnmounted(() => clearInterval(timer));

function formatRate(bytes: number): string {
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}
const pct = (v: number) => `${v.toFixed(0)} %`;
const deg = (v: number) => `${v.toFixed(1)} °C`;

type Metric = {
  key: string;
  label: string;
  icon: typeof Cpu;
  color: string;
  value: (p: HistoryPoint) => number;
  peak?: (p: HistoryPoint) => number; // the true peak, when the line is an average
  scale: (peak: number) => number;
  format: (v: number) => string;
};

// One chart per measure, each on its own scale. Colors follow the cards on
// the Home tab.
const METRICS: Metric[] = [
  { key: "cpu", label: "CPU", icon: Cpu, color: "#22c55e", value: (p) => p.cpu, peak: (p) => p.cpu_max, scale: () => 100, format: pct },
  { key: "temp", label: "Temperature", icon: Thermometer, color: "#f97316", value: (p) => p.temp, peak: (p) => p.temp_max, scale: (m) => Math.max(80, Math.ceil(m / 10) * 10), format: deg },
  { key: "ram", label: "RAM", icon: MemoryStick, color: "#a78bfa", value: (p) => p.ram, scale: () => 100, format: pct },
  { key: "disk", label: "Disk", icon: HardDrive, color: "#06b6d4", value: (p) => p.disk, scale: () => 100, format: pct },
  // The 1 KB/s floor keeps an idle link from looking like a spike.
  { key: "rx", label: "Down", icon: ArrowDown, color: "#38bdf8", value: (p) => p.rx, scale: (m) => Math.max(1024, m * 1.1), format: formatRate },
  { key: "tx", label: "Up", icon: ArrowUp, color: "#a78bfa", value: (p) => p.tx, scale: (m) => Math.max(1024, m * 1.1), format: formatRate },
];

const info = computed(() => RANGE_INFO[range.value]);

const charts = computed(() =>
  METRICS.map((m) => {
    const list = points.value ?? [];
    const series: ChartPoint[] = list.map((p) => ({ ts: p.ts, v: m.value(p) }));
    const values = series.map((p) => p.v);
    const peak = Math.max(0, ...list.map(m.peak ?? m.value));
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return { ...m, series, peak: list.length ? peak : null, avg, max: m.scale(peak) };
  }),
);
</script>

<template>
  <div class="page">
    <div class="card history">
      <div class="card-header">
        <ChartLine :size="16" />
        <span>History</span>
        <div class="ranges">
          <button
            v-for="r in HISTORY_RANGES"
            :key="r"
            type="button"
            class="range"
            :class="{ active: range === r }"
            :title="RANGE_INFO[r].label"
            @click="range = r"
          >
            {{ r }}
          </button>
        </div>
      </div>

      <div v-if="error" class="empty">Could not load history: {{ error }}</div>
      <div v-else-if="points === null" class="empty">Loading…</div>
      <div v-else class="grid">
        <section v-for="c in charts" :key="c.key" class="hist">
          <div class="hist-head">
            <span class="hist-title">
              <component :is="c.icon" :size="13" :style="{ color: c.color }" />
              {{ c.label }}
            </span>
            <span v-if="c.avg !== null" class="hist-stats">
              avg <b>{{ c.format(c.avg) }}</b> · peak <b>{{ c.format(c.peak!) }}</b>
            </span>
          </div>
          <HistoryChart
            :points="c.series"
            :color="c.color"
            :max="c.max"
            :from="now - info.span"
            :to="now"
            :bucket="info.bucket"
            :format="c.format"
          />
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history {
  width: 100%;
  max-width: 1460px;
}

.ranges {
  margin-left: auto;
  display: flex;
  gap: 6px;
}

.range {
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: transparent;
  color: var(--text-muted);
  font: 600 11px var(--font-mono);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}

.range:hover {
  color: var(--text);
}

.range.active {
  color: var(--primary);
  border-color: var(--primary);
  background: var(--primary-muted);
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

@media (min-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.hist {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.hist-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
}

.hist-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
}

.hist-stats {
  font-size: 10.5px;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

.hist-stats b {
  font-weight: 500;
  color: var(--text);
}

.empty {
  color: var(--text-muted);
  font-size: 13px;
  padding: 20px 0;
  text-align: center;
}
</style>
