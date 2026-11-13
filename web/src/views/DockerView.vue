<script setup lang="ts">
import { computed } from "vue";
import { Container } from "lucide-vue-next";
import UnitList, { type UnitFilter, type UnitSort } from "../components/UnitList.vue";
import { usePiStore } from "../stores/pi";
import { dockerRow } from "../utils/units";

const store = usePiStore();

const rows = computed(() => store.docker?.map((c) => dockerRow(c, store.dockerStats[c.name])) ?? null);

// Busiest first; stopped containers (no usage) go last.
const sorts: UnitSort[] = [
  { id: "name", label: "Name", compare: () => 0 },
  { id: "cpu", label: "CPU", compare: (a, b) => (b.usage?.cpu ?? -1) - (a.usage?.cpu ?? -1) },
  { id: "ram", label: "RAM", compare: (a, b) => (b.usage?.mem ?? -1) - (a.usage?.mem ?? -1) },
];

const filters: UnitFilter[] = [
  { id: "all", label: "All", test: () => true },
  { id: "running", label: "Running", test: (r) => r.tone === "on" },
  { id: "stopped", label: "Stopped", test: (r) => r.tone !== "on" },
  { id: "favorites", label: "Favorites", test: (r) => r.favorite },
];
</script>

<template>
  <div class="page">
    <UnitList
      title="Docker"
      :icon="Container"
      :rows="rows"
      :filters="filters"
      :sorts="sorts"
      empty-text="No containers — or Docker isn't installed on the Pi."
    />
  </div>
</template>
