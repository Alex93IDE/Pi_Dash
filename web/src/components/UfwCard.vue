<script setup lang="ts">
import { computed } from "vue";
import { Shield } from "lucide-vue-next";
import { usePiStore } from "../stores/pi";

const store = usePiStore();

function portFrom(to: string): number {
  const match = to.match(/\d+/);
  return match ? parseInt(match[0]) : Infinity;
}

// ufw keeps the rule comment inline, as "192.168.1.0/24 # SSH".
// Split it off so the source and the label get a column each.
function splitComment(from: string): { source: string; name: string } {
  const hash = from.indexOf("#");
  if (hash === -1) return { source: from.trim(), name: "" };
  return { source: from.slice(0, hash).trim(), name: from.slice(hash + 1).trim() };
}

const sortedRules = computed(() =>
  store.slowData.ufw_rules
    ? [...store.slowData.ufw_rules]
        .sort((a, b) => portFrom(a.to) - portFrom(b.to))
        .map((rule) => ({ ...rule, ...splitComment(rule.from) }))
    : null
);
</script>

<template>
  <div class="card">
    <div class="card-header">
      <Shield :size="16" />
      <span>Firewall</span>
      <span
        v-if="store.slowData.ufw_status"
        class="ufw-badge"
        :class="store.slowData.ufw_status === 'active' ? 'badge-active' : 'badge-inactive'"
      >
        {{ store.slowData.ufw_status }}
      </span>
    </div>

    <div class="card-body">
      <div v-if="!sortedRules" class="ufw-empty">—</div>
      <div v-else class="table-wrap">
        <table class="ufw-table">
          <thead>
            <tr>
              <th>#</th>
              <th>To</th>
              <th>Action</th>
              <th>From</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rule in sortedRules" :key="rule.num">
              <td class="col-num">{{ rule.num }}</td>
              <td class="col-to">{{ rule.to }}</td>
              <td class="col-action">
                <span
                  class="action-badge"
                  :class="rule.action.includes('ALLOW') ? 'action-allow' : 'action-deny'"
                >
                  {{ rule.action }}
                </span>
              </td>
              <td class="col-from">{{ rule.source }}</td>
              <td class="col-name">{{ rule.name || "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  width: 100%;
  max-width: 1000px;
  border-color: rgba(4, 145, 115, 0.15);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 0 32px rgba(4, 145, 115, 0.05),
    0 12px 40px rgba(0, 0, 0, 0.6);
}

.ufw-badge {
  margin-left: auto;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 20px;
}

.badge-active {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.badge-inactive {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.ufw-empty {
  color: var(--text-muted);
  font-size: 14px;
  padding: 20px 0;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.ufw-table {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 11.5px;
}

.ufw-table th {
  text-align: left;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 0 24px 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.ufw-table td {
  padding: 10px 24px 10px 0;
  color: var(--text);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.ufw-table tr:last-child td {
  border-bottom: none;
}

.ufw-table tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}

/* Columns size to their content; only # is pinned narrow. */
.col-num {
  color: var(--text-muted) !important;
  width: 1%;
}

.col-from {
  color: rgba(205, 214, 244, 0.6) !important;
}

.ufw-table td,
.ufw-table th {
  white-space: nowrap;
}

.ufw-table td:last-child,
.ufw-table th:last-child {
  padding-right: 0;
}

.col-name {
  color: var(--text-muted) !important;
  white-space: nowrap;
}

.action-badge {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 2px 7px;
  border-radius: 6px;
}

.action-allow {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.action-deny {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
</style>
