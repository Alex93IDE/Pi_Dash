<script setup lang="ts">
import { useRoute } from "vue-router";
import { House, MapPinOff } from "lucide-vue-next";

const route = useRoute();
</script>

<template>
  <div class="page">
    <div class="card">
      <div class="card-header">
        <MapPinOff :size="16" />
        <span>Not found</span>
      </div>
      <div class="card-body">
        <span class="code">404</span>
        <p class="message">
          There's nothing at <code>{{ route.path }}</code>.
        </p>
        <RouterLink :to="{ name: 'home' }" class="home">
          <House :size="14" />
          Back to Home
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.code {
  font-size: 48px;
  font-weight: 700;
  font-family: var(--font-mono);
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--text-dim);
}

.message {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  overflow-wrap: anywhere;
}

.message code {
  color: var(--text);
}

.home {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid var(--primary);
  background: var(--primary-muted);
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s;
}

.home:hover {
  background: rgba(4, 145, 115, 0.25);
}
</style>
