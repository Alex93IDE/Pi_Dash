<script setup lang="ts">
import { computed, ref, useId } from "vue";

export type ChartPoint = { ts: number; v: number };

const props = defineProps<{
  points: ChartPoint[];
  color: string;
  max: number; // top of the scale
  from: number; // left edge, ms since epoch
  to: number; // right edge
  bucket: number; // ms per point; a longer gap means the Pi was off
  format: (v: number) => string;
}>();

const W = 600;
const H = 140;
const gradientId = `hist-${useId()}`;

const x = (ts: number) => ((ts - props.from) / (props.to - props.from || 1)) * W;
const y = (v: number) => H - (Math.min(Math.max(v, 0), props.max) / (props.max || 1)) * (H - 6) - 3;

// Split the line wherever data is missing, instead of drawing a straight
// line across the time the Pi was off.
const segments = computed(() => {
  const out: ChartPoint[][] = [];
  let current: ChartPoint[] = [];
  for (const p of props.points) {
    const prev = current.at(-1);
    if (prev && p.ts - prev.ts > props.bucket * 2.5) {
      out.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length) out.push(current);
  return out.map((seg) => {
    const line = seg.map((p) => `${x(p.ts).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const first = x(seg[0].ts).toFixed(1);
    const last = x(seg.at(-1)!.ts).toFixed(1);
    return { line, area: `${first},${H} ${line} ${last},${H}`, single: seg.length === 1 };
  });
});

// ── Hover: crosshair on the nearest point ────────────────
const svg = ref<SVGSVGElement | null>(null);
const hover = ref<ChartPoint | null>(null);

function onMove(e: PointerEvent) {
  if (!svg.value || !props.points.length) return;
  const rect = svg.value.getBoundingClientRect();
  const ts = props.from + ((e.clientX - rect.left) / rect.width) * (props.to - props.from);
  let best = props.points[0];
  for (const p of props.points) if (Math.abs(p.ts - ts) < Math.abs(best.ts - ts)) best = p;
  hover.value = Math.abs(best.ts - ts) <= props.bucket * 2 ? best : null;
}

const hoverLeft = computed(() => (hover.value ? (x(hover.value.ts) / W) * 100 : 0));

const spanDays = computed(() => (props.to - props.from) / 86_400_000);
function formatTs(ts: number, withDate = spanDays.value > 1) {
  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return withDate ? `${d.toLocaleDateString([], { day: "2-digit", month: "short" })} ${time}` : time;
}
</script>

<template>
  <div class="chart" @pointermove="onMove" @pointerleave="hover = null">
    <div class="plot">
    <svg v-if="points.length" ref="svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none">
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.22" />
          <stop offset="100%" :stop-color="color" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line class="grid" x1="0" :x2="W" :y1="y(max / 2)" :y2="y(max / 2)" />
      <template v-for="(s, i) in segments" :key="i">
        <polygon v-if="!s.single" :points="s.area" :fill="`url(#${gradientId})`" />
        <polyline
          :points="s.line"
          fill="none"
          :stroke="color"
          stroke-width="2"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </template>
      <line
        v-if="hover"
        class="crosshair"
        :x1="x(hover.ts)"
        :x2="x(hover.ts)"
        y1="0"
        :y2="H"
      />
    </svg>
    <span v-else class="chart-empty">No data for this range yet.</span>
    <span
      v-if="hover"
      class="dot"
      :style="{ left: `${hoverLeft}%`, top: `${((y(hover.v) / H) * 100).toFixed(1)}%`, background: color }"
    />
    </div>
    <div v-if="hover" class="tooltip" :class="{ flip: hoverLeft > 60 }" :style="{ left: `${hoverLeft}%` }">
      <span class="tooltip-value">{{ format(hover.v) }}</span>
      <span class="tooltip-time">{{ formatTs(hover.ts, true) }}</span>
    </div>

    <span v-if="points.length" class="label top">{{ format(max) }}</span>
    <span v-if="points.length" class="label bottom">0</span>
    <span class="label start">{{ formatTs(from) }}</span>
    <span class="label end">{{ formatTs(to) }}</span>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  width: 100%;
  height: 170px;
  padding: 20px 0 20px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  touch-action: pan-y;
}

.plot {
  position: relative;
  height: 100%;
}

.chart svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.grid {
  stroke: rgba(255, 255, 255, 0.05);
  stroke-dasharray: 3 4;
  vector-effect: non-scaling-stroke;
}

.crosshair {
  stroke: rgba(226, 228, 239, 0.35);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.dot {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--bg-surface);
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.tooltip {
  position: absolute;
  top: 6px;
  transform: translateX(8px);
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 5px 8px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  pointer-events: none;
  white-space: nowrap;
  z-index: 1;
}

.tooltip.flip {
  transform: translateX(calc(-100% - 8px));
}

.tooltip-value {
  font: 600 12px var(--font-mono);
  color: var(--text);
}

.tooltip-time {
  font: 10px var(--font-mono);
  color: var(--text-muted);
}

.chart-empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--text-muted);
}

.label {
  position: absolute;
  font-size: 9px;
  font-family: var(--font-mono);
  color: rgba(107, 112, 144, 0.7);
}

.top { top: 5px; left: 10px; }
.bottom { bottom: 22px; left: 10px; }
.start { bottom: 4px; left: 10px; }
.end { bottom: 4px; right: 10px; }
</style>
