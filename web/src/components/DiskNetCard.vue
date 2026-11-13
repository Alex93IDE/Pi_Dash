<script setup lang="ts">
import { computed } from "vue";
import {
  HardDrive,
  Thermometer,
  Clock,
  AlertTriangle,
  AlertCircle,
  Database,
} from "lucide-vue-next";
import { usePiStore } from "../stores/pi";
import { toNumber } from "../utils/number";

const store = usePiStore();

const diskPct = computed(() => store.fastData.disk_pct);
const diskUsed = computed(() => store.fastData.disk_used);
const diskTotal = computed(() => store.fastData.disk_total);

const nvmeTemp = computed(() => store.slowData.nvme_temp);
const nvmeSpare = computed(() => store.slowData.nvme_spare);
const nvmeUsed = computed(() => store.slowData.nvme_used);
const nvmeHours = computed(() => store.slowData.nvme_hours);
const nvmeUnsafe = computed(() => store.slowData.nvme_unsafe);
const nvmeErrors = computed(() => store.slowData.nvme_errors);

const usedGB = computed(() =>
  diskUsed.value !== null ? diskUsed.value.toFixed(1) : null
);
const totalGB = computed(() =>
  diskTotal.value !== null ? diskTotal.value.toFixed(0) : null
);

const pctColor = computed(() => {
  const p = diskPct.value;
  if (p === null) return "#525875";
  if (p >= 90) return "#ef4444";
  if (p >= 75) return "#f97316";
  return "#f59e0b";
});

const CIRC = 2 * Math.PI * 52;
const pctDash = computed(() => {
  const filled = ((diskPct.value ?? 0) / 100) * CIRC;
  return `${filled} ${CIRC}`;
});

const nvmeTempColor = computed(() => {
  const t = toNumber(nvmeTemp.value);
  if (t === null) return "#525875";
  if (t >= 70) return "#ef4444";
  if (t >= 55) return "#f97316";
  return "#22c55e";
});

const nvmeSpareColor = computed(() => {
  const s = toNumber(nvmeSpare.value);
  if (s === null) return "#525875";
  if (s <= 10) return "#ef4444";
  if (s <= 25) return "#f97316";
  return "#22c55e";
});

const nvmeUsedColor = computed(() => {
  const u = toNumber(nvmeUsed.value);
  if (u === null) return "#525875";
  if (u >= 90) return "#ef4444";
  if (u >= 75) return "#f97316";
  return "#a78bfa";
});

const hoursFormatted = computed(() => {
  const h = toNumber(nvmeHours.value);
  if (h === null) return null;
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ${h % 24}h`;
  const months = Math.floor(days / 30);
  const remDays = days % 30;
  if (months < 12) return `${months}mo ${remDays}d`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0 ? `${years}y ${remMonths}mo` : `${years}y`;
});
</script>

<template>
  <div class="card">
    <div class="card-header">
      <HardDrive :size="16" />
      <span>Disk / NVMe</span>
    </div>

    <div class="card-body">
      <!-- Gauge centrado -->
      <div class="gauge-wrap">
        <svg class="gauge" viewBox="0 0 120 120">
          <defs>
            <filter id="glow-disk" x="-50%" y="-50%" width="200%" height="200%">
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
            filter="url(#glow-disk)"
          />
        </svg>
        <div class="gauge-label">
          <span class="gauge-value" :style="{ color: pctColor }">
            {{ diskPct !== null ? diskPct.toFixed(0) : "—" }}
          </span>
          <span class="gauge-unit" :style="{ color: pctColor }">%</span>
        </div>
      </div>

      <!-- Fila inferior: disk used/total, separador, nvme grid -->
      <div class="bottom-row">
        <div class="disk-metrics">
          <div class="metric">
            <HardDrive :size="14" :style="{ color: pctColor }" />
            <div class="metric-content">
              <span class="metric-label">Used</span>
              <span class="metric-value" :style="{ color: pctColor }">
                {{ usedGB !== null ? `${usedGB}G` : "—" }}
              </span>
            </div>
          </div>
          <div class="metric">
            <Database :size="14" style="color: rgba(245, 158, 11, 0.45)" />
            <div class="metric-content">
              <span class="metric-label">Total</span>
              <span class="metric-value" style="color: rgba(245, 158, 11, 0.6)">
                {{ totalGB !== null ? `${totalGB}G` : "—" }}
              </span>
            </div>
          </div>
        </div>

        <div class="h-divider" />

        <div class="nvme-grid">
          <div class="nvme-item">
            <Thermometer :size="12" :style="{ color: nvmeTempColor }" />
            <div class="nvme-content">
              <span class="nvme-label">Temp</span>
              <span :style="{ color: nvmeTempColor }">
                {{ nvmeTemp !== null ? `${nvmeTemp}°C` : "—" }}
              </span>
            </div>
          </div>
          <div class="nvme-item">
            <Database :size="12" :style="{ color: nvmeUsedColor }" />
            <div class="nvme-content">
              <span class="nvme-label">Wear</span>
              <span :style="{ color: nvmeUsedColor }">
                {{ nvmeUsed !== null ? `${nvmeUsed}` : "—" }}
              </span>
            </div>
          </div>
          <div class="nvme-item">
            <HardDrive :size="12" :style="{ color: nvmeSpareColor }" />
            <div class="nvme-content">
              <span class="nvme-label">Spare</span>
              <span :style="{ color: nvmeSpareColor }">
                {{ nvmeSpare !== null ? `${nvmeSpare}` : "—" }}
              </span>
            </div>
          </div>
          <div class="nvme-item">
            <Clock :size="12" style="color: #38bdf8" />
            <div class="nvme-content">
              <span class="nvme-label">Hours</span>
              <span style="color: #38bdf8">{{ hoursFormatted ?? "—" }}</span>
            </div>
          </div>
          <div class="nvme-item">
            <AlertTriangle :size="12" style="color: #fb923c" />
            <div class="nvme-content">
              <span class="nvme-label">Unsafe</span>
              <span style="color: #fb923c">
                {{ nvmeUnsafe !== null ? nvmeUnsafe : "—" }}
              </span>
            </div>
          </div>
          <div class="nvme-item">
            <AlertCircle :size="12" style="color: #f87171" />
            <div class="nvme-content">
              <span class="nvme-label">Errors</span>
              <span style="color: #f87171">
                {{ nvmeErrors !== null ? nvmeErrors : "—" }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  border-color: rgba(245, 158, 11, 0.15);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 0 32px rgba(245, 158, 11, 0.06), 0 12px 40px rgba(0, 0, 0, 0.6);
}

/* Card is 350px like CPU and RAM: disk used/total on one row, NVMe grid below. */
.bottom-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.disk-metrics {
  display: flex;
  gap: 7px;
}

.disk-metrics .metric {
  width: 100%;
}

.h-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
}

.nvme-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  flex: 1;
}

.nvme-item {
  display: flex;
  align-items: center;
  gap: 7px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 9px;
  padding: 7px 9px;
}

.nvme-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nvme-label {
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: rgba(107, 112, 144, 0.65);
}

.nvme-content span:last-child {
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-mono);
  line-height: 1;
}
</style>
