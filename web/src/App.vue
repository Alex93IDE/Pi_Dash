<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useApi } from "./composables/api";
import UpdateBanner from "./components/UpdateBanner.vue";

const { connect, disconnect } = useApi();

onMounted(() => {
  connect();
});
onUnmounted(() => disconnect());
</script>

<template>
  <router-view />
  <UpdateBanner />
</template>
