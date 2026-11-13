<script setup lang="ts">
import { computed, ref, type Component } from "vue";
import { LoaderCircle, Play, RotateCw, Search, Square, Star } from "lucide-vue-next";
import { useApi } from "../composables/api";
import { favoriteKey, usePiStore } from "../stores/pi";
import { formatBytes, type UnitRow } from "../utils/units";
import type { UnitAction } from "../../../shared/types";

export type UnitSort = {
  id: string;
  label: string;
  compare: (a: UnitRow, b: UnitRow) => number;
};

export type UnitFilter = {
  id: string;
  label: string;
  test: (row: UnitRow) => boolean;
};

const props = defineProps<{
  title: string;
  icon: Component;
  rows: UnitRow[] | null; // null = nothing received yet
  filters: UnitFilter[];
  sorts?: UnitSort[]; // offered as buttons; by name when there are none
  emptyText: string;
}>();

const store = usePiStore();
const { setFavorite, unitAction } = useApi();

const query = ref("");
const activeSort = ref(props.sorts?.[0]?.id);
const activeFilter = ref(props.filters[0]?.id);

function countFor(filter: UnitFilter) {
  return (props.rows ?? []).filter(filter.test).length;
}

// Running/active units out of everything reported, regardless of filter or search.
const activeCount = computed(() => (props.rows ?? []).filter((r) => r.tone === "on").length);

const visible = computed(() => {
  const filter = props.filters.find((f) => f.id === activeFilter.value);
  const q = query.value.trim().toLowerCase();
  return (props.rows ?? [])
    .filter((r) => !filter || filter.test(r))
    .filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q)
    )
    .sort(
      (a, b) =>
        (props.sorts?.find((s) => s.id === activeSort.value)?.compare(a, b) ?? 0) ||
        a.title.localeCompare(b.title)
    );
});

function isPending(row: UnitRow) {
  return favoriteKey(row.source, row.name) in store.pendingFavorites;
}

function toggleFavorite(row: UnitRow) {
  if (isPending(row)) return;
  setFavorite(row.source, row.name, !row.favorite);
}

// ── Start / stop / restart ───────────────────────────────
const canControl = computed(() => store.server?.unitControl ?? false);

function actionPending(row: UnitRow) {
  return store.pendingActions[favoriteKey(row.source, row.name)];
}

// Stopped units only offer start; running ones restart and stop — except
// protected units, which can't be stopped from here.
function actionsFor(row: UnitRow): UnitAction[] {
  if (row.tone !== "on") return ["start"];
  const isProtected = row.source === "systemd" && store.server?.protectedUnits.includes(row.name);
  return isProtected ? ["restart"] : ["restart", "stop"];
}

// Same hues as the CPU and RAM cards; amber and red when it's getting heavy.
const CPU_COLOR = "#38bdf8";
const RAM_COLOR = "#a78bfa";
function usageColor(pct: number, normal: string) {
  if (pct >= 90) return "#ef4444";
  if (pct >= 70) return "#f97316";
  return normal;
}

const ACTION_ICON = { start: Play, stop: Square, restart: RotateCw };

// Last failure per row, shown under it until the next attempt.
const errors = ref<Record<string, string>>({});

async function act(row: UnitRow, action: UnitAction) {
  if (actionPending(row)) return;
  // Starting is harmless; stopping or restarting something can cut you off.
  if (action !== "start" && !window.confirm(`${action[0].toUpperCase()}${action.slice(1)} ${row.title}?`)) return;
  const key = favoriteKey(row.source, row.name);
  delete errors.value[key];
  const error = await unitAction(row.source, row.name, action);
  if (error) errors.value[key] = error;
}
</script>

<template>
  <div class="card">
    <div class="card-header">
      <component :is="icon" :size="16" />
      <span>{{ title }}</span>
      <span v-if="rows" class="count" title="Active / total">
        <span class="count-active">{{ activeCount }}</span> / {{ rows.length }}
      </span>
    </div>

    <div class="toolbar">
      <label class="search">
        <Search :size="13" />
        <input v-model="query" type="search" placeholder="Search name or description…" />
      </label>
      <div class="filters">
        <button
          v-for="f in filters"
          :key="f.id"
          type="button"
          class="filter"
          :class="{ active: activeFilter === f.id }"
          @click="activeFilter = f.id"
        >
          {{ f.label }} <span class="filter-count">{{ countFor(f) }}</span>
        </button>
      </div>
      <div v-if="sorts?.length" class="filters sorts">
        <span class="sort-label">Sort</span>
        <button
          v-for="s in sorts"
          :key="s.id"
          type="button"
          class="filter"
          :class="{ active: activeSort === s.id }"
          @click="activeSort = s.id"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <div v-if="rows === null" class="empty">Waiting for data…</div>
    <div v-else-if="!rows.length" class="empty">{{ emptyText }}</div>
    <div v-else-if="!visible.length" class="empty">No matches.</div>
    <ul v-else class="rows">
      <li v-for="row in visible" :key="row.name" class="row" :class="`tone-${row.tone}`">
        <button
          type="button"
          class="star"
          :class="{ on: row.favorite, pending: isPending(row) }"
          :title="row.favorite ? 'Remove from favorites' : 'Add to favorites'"
          @click="toggleFavorite(row)"
        >
          <Star :size="15" :fill="row.favorite ? 'currentColor' : 'none'" />
        </button>
        <span class="dot" />
        <div class="info">
          <span class="title">{{ row.title }}</span>
          <span class="subtitle">{{ row.subtitle }}</span>
        </div>
        <div v-if="row.usage" class="usage">
          <span class="meter" title="CPU — 100 % is one full core">
            <span class="meter-label">CPU</span>
            <span class="meter-value" :style="{ color: usageColor(row.usage.cpu, CPU_COLOR) }">
              {{ row.usage.cpu.toFixed(1) }}%
            </span>
            <span class="meter-bar">
              <span
                :style="{ width: `${Math.min(row.usage.cpu, 100)}%`, background: usageColor(row.usage.cpu, CPU_COLOR) }"
              />
            </span>
          </span>
          <span class="meter" :title="`RAM — ${row.usage.memPct.toFixed(1)} % of the Pi's memory`">
            <span class="meter-label">RAM</span>
            <span class="meter-value" :style="{ color: usageColor(row.usage.memPct, RAM_COLOR) }">
              {{ formatBytes(row.usage.mem) }}
            </span>
            <span class="meter-bar">
              <span
                :style="{
                  width: `${Math.min(Math.max(row.usage.memPct, 2), 100)}%`,
                  background: usageColor(row.usage.memPct, RAM_COLOR),
                }"
              />
            </span>
          </span>
        </div>
        <span v-if="row.tag" class="tag">{{ row.tag }}</span>
        <span class="status">{{ row.status }}</span>
        <div v-if="canControl" class="actions">
          <LoaderCircle v-if="actionPending(row)" :size="14" class="spin" />
          <template v-else>
            <button
              v-for="a in actionsFor(row)"
              :key="a"
              type="button"
              class="action"
              :class="`action-${a}`"
              :title="a[0].toUpperCase() + a.slice(1)"
              @click="act(row, a)"
            >
              <component :is="ACTION_ICON[a]" :size="12" />
            </button>
          </template>
        </div>
        <span v-if="errors[favoriteKey(row.source, row.name)]" class="error">
          {{ errors[favoriteKey(row.source, row.name)] }}
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.card {
  width: 100%;
}

.count {
  margin-left: auto;
  font-family: var(--font-mono);
  letter-spacing: 0.05em;
}

.count-active {
  color: #22c55e;
}

/* Toolbar */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.search {
  flex: 1 1 220px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.055);
  color: var(--text-muted);
}

.search:focus-within {
  border-color: var(--primary);
}

.search input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  outline: none;
  color: var(--text);
  font: 12.5px var(--font-sans);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter {
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: transparent;
  color: var(--text-muted);
  font: 600 11px var(--font-sans);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}

.filter:hover {
  color: var(--text);
}

.filter.active {
  color: var(--primary);
  border-color: var(--primary);
  background: var(--primary-muted);
}

.sort-label {
  align-self: center;
  font-size: 10px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  margin-left: 4px;
}

.usage {
  flex-shrink: 0;
  display: flex;
  gap: 12px;
}

.meter {
  display: grid;
  grid-template-columns: auto auto;
  align-items: baseline;
  column-gap: 6px;
  row-gap: 3px;
  min-width: 82px;
}

.meter-label {
  font-size: 9px;
  font-family: var(--font-mono);
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.meter-value {
  justify-self: end;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-mono);
  white-space: nowrap;
}

.meter-bar {
  grid-column: 1 / -1;
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.meter-bar > span {
  display: block;
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s ease;
}

.filter-count {
  font-family: var(--font-mono);
  opacity: 0.6;
  margin-left: 2px;
}

/* Rows */
.empty {
  color: var(--text-muted);
  font-size: 13px;
  padding: 20px 0;
  text-align: center;
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.star {
  display: flex;
  padding: 2px;
  border: none;
  background: none;
  color: var(--text-dim);
  cursor: pointer;
  transition: color 0.2s;
}

.star:hover {
  color: var(--text-muted);
}

.star.on {
  color: #facc15;
}

.star.pending {
  cursor: wait;
  animation: pulse 1s infinite;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtitle {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-muted);
  font-size: 9.5px;
  font-family: var(--font-mono);
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.status {
  flex-shrink: 0;
  max-width: 40%;
  font-size: 10.5px;
  font-family: var(--font-mono);
  text-align: right;
}

/* Tones */
.tone-on .dot { background: #22c55e; box-shadow: 0 0 6px rgba(34, 197, 94, 0.6); }
.tone-on .status { color: #22c55e; }
.tone-warn .dot { background: #f59e0b; box-shadow: 0 0 6px rgba(245, 158, 11, 0.5); }
.tone-warn .status { color: #f59e0b; }
.tone-off .dot { background: #ef4444; box-shadow: 0 0 6px rgba(239, 68, 68, 0.5); }
.tone-off .status { color: #ef4444; }
.tone-off { border-color: rgba(239, 68, 68, 0.15); }
.tone-idle .dot { background: #525875; }
.tone-idle .status { color: #525875; }

/* Actions */
.actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 52px;
  justify-content: flex-end;
  color: var(--text-muted);
}

.action {
  display: flex;
  padding: 5px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}

.action-start:hover { color: #22c55e; border-color: rgba(34, 197, 94, 0.4); }
.action-restart:hover { color: #f59e0b; border-color: rgba(245, 158, 11, 0.4); }
.action-stop:hover { color: #ef4444; border-color: rgba(239, 68, 68, 0.4); }

.spin {
  animation: spin 1s linear infinite;
}

.error {
  flex-basis: 100%;
  padding-left: 47px;
  font-size: 10.5px;
  color: #ef4444;
  overflow-wrap: anywhere;
}

.row {
  flex-wrap: wrap;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  50% { opacity: 0.3; }
}

/* Phone: star, dot and name on the first line; tag and status wrap below,
   lined up with the name (star 19px + dot 8px + two 10px gaps = 47px). */
@media (max-width: 540px) {
  .row {
    flex-wrap: wrap;
    row-gap: 4px;
  }

  .info {
    flex-basis: calc(100% - 47px);
  }

  .tag {
    margin-left: 47px;
  }

  /* Meters get a line of their own, status and buttons the next. */
  .usage {
    margin-left: 47px;
    flex-basis: calc(100% - 47px);
  }

  .usage .meter {
    flex: 1;
  }

  .usage + .status {
    margin-left: 47px;
  }

  .status {
    max-width: none;
    text-align: left;
  }

  .row > .status:nth-child(4) {
    margin-left: 47px;
  }

  .actions {
    margin-left: auto;
  }
}
</style>
