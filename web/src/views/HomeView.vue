<script setup lang="ts">
import DiskNetCard from "../components/DiskNetCard.vue";
import CpuCard from "../components/CpuCard.vue";
import RamCard from "../components/RamCard.vue";
import AlertsCard from "../components/AlertsCard.vue";
import NetworkCard from "../components/NetworkCard.vue";
</script>

<template>
  <div class="page">
    <div class="home-grid">
      <CpuCard />
      <RamCard />
      <DiskNetCard />
      <NetworkCard />
      <AlertsCard class="span-all" />
    </div>
  </div>
</template>

<style scoped>
/*
 * Four 350px cards: one column, two by two, or all four in a row — never
 * three and one. Alerts spans the grid, so it's never wider than the cards
 * above it. Two columns start at tablet width (a Tab S10 FE in portrait is
 * ~800px) and are allowed to shrink a little below 350px to fit.
 */
.home-grid {
  --col: 350px;
  display: grid;
  grid-template-columns: minmax(0, var(--col));
  justify-content: center;
  gap: 20px;
  width: 100%;
}

/* Cards in the same row share its height, so the row reads as one block. */
.home-grid > :deep(.card) {
  width: auto;
  max-width: none;
}

.span-all {
  grid-column: 1 / -1;
}

@media (min-width: 700px) {
  .home-grid {
    grid-template-columns: repeat(2, minmax(0, var(--col)));
  }
}

@media (min-width: 1580px) {
  .home-grid {
    grid-template-columns: repeat(4, var(--col));
  }
}

@media (max-width: 640px) {
  .home-grid {
    gap: 16px;
  }
}
</style>
