<script setup lang="ts">
import { computed } from "vue";
import { Activity } from "lucide-vue-next";
import UnitList, { type UnitFilter } from "../components/UnitList.vue";
import { usePiStore } from "../stores/pi";
import { systemdRow } from "../utils/units";

const store = usePiStore();

const rows = computed(() => store.services?.map(systemdRow) ?? null);

const filters: UnitFilter[] = [
  { id: "all", label: "All", test: () => true },
  { id: "active", label: "Active", test: (r) => r.tone === "on" },
  { id: "failed", label: "Failed", test: (r) => r.tone === "off" },
  { id: "favorites", label: "Favorites", test: (r) => r.favorite },
];
</script>

<template>
  <div class="page">
    <UnitList
      title="Services"
      :icon="Activity"
      :rows="rows"
      :filters="filters"
      empty-text="The publisher reported no systemd services."
    />
  </div>
</template>
