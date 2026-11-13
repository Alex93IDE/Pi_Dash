<script setup lang="ts">
import { RouterLink } from "vue-router";
import { TriangleAlert, CircleCheck } from "lucide-vue-next";
import { useAlerts } from "../composables/alerts";

const { alerts, errorCount } = useAlerts();
</script>

<template>
  <div class="card alerts-card" :class="{ 'has-errors': errorCount > 0 }">
    <div class="card-header">
      <TriangleAlert :size="16" />
      <span>Alerts</span>
      <span v-if="alerts.length" class="count" :class="errorCount ? 'count-error' : 'count-warn'">
        {{ alerts.length }}
      </span>
    </div>

    <div class="card-body">
      <div v-if="!alerts.length" class="ok">
        <CircleCheck :size="28" />
        <span>Everything looks fine</span>
      </div>
      <ul v-else class="alerts">
        <li v-for="(a, i) in alerts" :key="i">
          <component
            :is="a.to ? RouterLink : 'div'"
            :to="a.to ? { name: a.to } : undefined"
            class="alert"
            :class="`alert-${a.level}`"
          >
            <span class="dot" />
            <span class="title">{{ a.title }}</span>
            <span class="detail">{{ a.detail }}</span>
          </component>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.card {
  width: 100%;
  border-color: rgba(245, 158, 11, 0.15);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 0 32px rgba(245, 158, 11, 0.04), 0 12px 40px rgba(0, 0, 0, 0.6);
}

.card.has-errors {
  border-color: rgba(239, 68, 68, 0.25);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 0 32px rgba(239, 68, 68, 0.07), 0 12px 40px rgba(0, 0, 0, 0.6);
}

.count {
  margin-left: auto;
  padding: 1px 8px;
  border-radius: 999px;
  font-family: var(--font-mono);
  letter-spacing: 0;
}

.count-error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
}

.count-warn {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.12);
}

.ok {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  color: #22c55e;
  font-size: 13px;
}

.alerts {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: inherit;
  text-decoration: none;
}

a.alert:hover {
  background: rgba(255, 255, 255, 0.06);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.title {
  flex-shrink: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
}

.detail {
  margin-left: auto;
  min-width: 0;
  font-size: 10.5px;
  font-family: var(--font-mono);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alert-error {
  border-color: rgba(239, 68, 68, 0.15);
}

.alert-error .dot {
  background: #ef4444;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.5);
}

.alert-error .detail {
  color: #ef4444;
}

.alert-warn .dot {
  background: #f59e0b;
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
}

.alert-warn .detail {
  color: #f59e0b;
}
</style>
