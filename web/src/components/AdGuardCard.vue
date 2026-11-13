<script setup lang="ts">
import { computed } from "vue";
import { ShieldCheck, ShieldOff, ShieldQuestion } from "lucide-vue-next";
import Sparkline, { type SparkSeries } from "./Sparkline.vue";
import { usePiStore } from "../stores/pi";

const store = usePiStore();
const ag = computed(() => store.adguard);

const QUERIES_COLOR = "#38bdf8";
const BLOCKED_COLOR = "#f87171";

const fmt = (n: number) => n.toLocaleString();

// Both series on one scale, so the blocked share reads as a slice of the total.
const chart = computed(() => {
  const d = ag.value;
  if (!d) return { series: [] as SparkSeries[], max: 1 };
  return {
    max: Math.max(1, ...d.queries_series),
    series: [
      { values: d.queries_series, color: QUERIES_COLOR, fill: true },
      { values: d.blocked_series, color: BLOCKED_COLOR },
    ] as SparkSeries[],
  };
});

const topMax = computed(() => Math.max(1, ...(ag.value?.top_blocked.map((t) => t.count) ?? [])));
</script>

<template>
  <!-- Hidden until configured: ADGUARD_URL in .env. -->
  <div v-if="ag" class="card adguard-card">
    <div class="card-header">
      <ShieldCheck v-if="ag.ok && ag.protection" :size="16" />
      <ShieldOff v-else-if="ag.ok" :size="16" />
      <ShieldQuestion v-else :size="16" />
      <span>AdGuard</span>
      <span v-if="ag.ok" class="badge" :class="ag.protection ? 'on' : 'off'">
        {{ ag.protection ? "Protected" : "Protection off" }}
      </span>
    </div>

    <div v-if="!ag.ok" class="unreachable">
      Can't read AdGuard: <b>{{ ag.error }}</b>. Check ADGUARD_URL, ADGUARD_USER and ADGUARD_PASS in .env.
    </div>

    <div v-else class="body">
      <div class="left">
        <div class="stats">
          <div class="stat">
            <span class="stat-label">Queries</span>
            <span class="stat-value" :style="{ color: QUERIES_COLOR }">{{ fmt(ag.queries) }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Blocked</span>
            <span class="stat-value" :style="{ color: BLOCKED_COLOR }">
              {{ fmt(ag.blocked) }} <small>{{ ag.blocked_pct }}%</small>
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Avg time</span>
            <span class="stat-value">{{ ag.avg_ms }} <small>ms</small></span>
          </div>
        </div>
        <Sparkline :series="chart.series" :max="chart.max" :top-label="fmt(chart.max)" :span="ag.span" />
        <div class="legend">
          <span><i :style="{ background: QUERIES_COLOR }" /> Queries</span>
          <span><i :style="{ background: BLOCKED_COLOR }" /> Blocked</span>
        </div>
      </div>

      <div class="right">
        <span class="stat-label">Top blocked</span>
        <ul v-if="ag.top_blocked.length" class="top">
          <li v-for="t in ag.top_blocked" :key="t.domain">
            <span class="domain" :title="t.domain">{{ t.domain }}</span>
            <span class="count">{{ fmt(t.count) }}</span>
            <span class="bar"><span :style="{ width: `${(t.count / topMax) * 100}%` }" /></span>
          </li>
        </ul>
        <span v-else class="none">Nothing blocked yet.</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.adguard-card {
  border-color: rgba(56, 189, 248, 0.15);
}

.badge {
  margin-left: auto;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid;
  font-size: 10px;
  font-family: var(--font-mono);
  letter-spacing: 0.03em;
  text-transform: none;
}

.badge.on {
  color: #22c55e;
  border-color: rgba(34, 197, 94, 0.4);
}

.badge.off {
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.4);
}

.unreachable {
  font-size: 12.5px;
  color: #9aa0bd;
  line-height: 1.5;
}

.unreachable b {
  color: #f59e0b;
}

.body {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

@media (min-width: 700px) {
  .body {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  }
}

.left,
.right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.055);
}

.stat-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.stat-value {
  font: 600 17px var(--font-mono);
  color: var(--text);
  white-space: nowrap;
}

.stat-value small {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.8;
}

.legend {
  display: flex;
  gap: 14px;
  font-size: 10.5px;
  font-family: var(--font-mono);
  color: #9aa0bd;
}

.legend i {
  display: inline-block;
  width: 10px;
  height: 2px;
  margin-right: 5px;
  vertical-align: middle;
  border-radius: 1px;
}

.top {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.top li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  row-gap: 4px;
  column-gap: 10px;
}

.domain {
  font-size: 12px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  font: 600 11.5px var(--font-mono);
  color: #9aa0bd;
}

.bar {
  grid-column: 1 / -1;
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.bar > span {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: #f87171;
}

.none {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
