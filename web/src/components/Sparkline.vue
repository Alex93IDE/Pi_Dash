<script setup lang="ts">
import { computed, useId } from "vue";

export type SparkSeries = {
  values: number[];
  color: string;
  fill?: boolean; // shade the area under this line
};

const props = withDefaults(
  defineProps<{
    series: SparkSeries[];
    max: number; // top of the scale; all series share it
    min?: number; // bottom of the scale
    topLabel?: string; // printed top-left, usually what `max` means
    bottomLabel?: string; // printed bottom-left, usually what `min` means
    span?: string;
  }>(),
  { min: 0, span: "last 60 s" }
);

const W = 300;
const H = 70;
const gradientId = `spark-${useId()}`;

const paths = computed(() =>
  props.series
    .filter((s) => s.values.length >= 2)
    .map((s) => {
      const n = s.values.length;
      const points = s.values
        .map((v, i) => {
          const x = (i / (n - 1)) * W;
          const range = props.max - props.min || 1;
          const clamped = Math.min(Math.max(v, props.min), props.max);
          const y = H - ((clamped - props.min) / range) * (H - 4) - 2;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
      return { ...s, points, area: `0,${H} ${points} ${W},${H}` };
    })
);

const filled = computed(() => paths.value.find((p) => p.fill));
</script>

<template>
  <div class="chart">
    <svg v-if="paths.length" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none">
      <defs v-if="filled">
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="filled.color" stop-opacity="0.25" />
          <stop offset="100%" :stop-color="filled.color" stop-opacity="0" />
        </linearGradient>
      </defs>
      <polygon v-if="filled" :points="filled.area" :fill="`url(#${gradientId})`" />
      <polyline
        v-for="(p, i) in paths"
        :key="i"
        :points="p.points"
        fill="none"
        :stroke="p.color"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <span v-else class="chart-empty">Collecting…</span>
    <span v-if="paths.length && topLabel" class="chart-top">{{ topLabel }}</span>
    <span v-if="paths.length && bottomLabel" class="chart-bottom">{{ bottomLabel }}</span>
    <span class="chart-span">{{ span }}</span>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  width: 100%;
  height: 110px;
  padding: 22px 0 18px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

.chart svg {
  display: block;
  width: 100%;
  height: 100%;
}

.chart-empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--text-muted);
}

.chart-top,
.chart-bottom,
.chart-span {
  position: absolute;
  font-size: 9px;
  font-family: var(--font-mono);
  color: rgba(107, 112, 144, 0.7);
}

.chart-top {
  top: 6px;
  left: 10px;
}

.chart-bottom {
  bottom: 4px;
  left: 10px;
}

.chart-span {
  bottom: 4px;
  right: 10px;
}
</style>
