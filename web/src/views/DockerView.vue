<script setup lang="ts">
import { computed } from "vue";
import { Container } from "lucide-vue-next";
import UnitList, { type UnitFilter } from "../components/UnitList.vue";
import { usePiStore } from "../stores/pi";
import { dockerRow } from "../utils/units";

const store = usePiStore();

const rows = computed(() => store.docker?.map(dockerRow) ?? null);

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
      empty-text="No containers — or Docker isn't installed on the Pi."
    />
  </div>
</template>
