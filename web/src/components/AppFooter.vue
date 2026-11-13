<script setup lang="ts">
// Release version (package.json) and build timestamp, both injected at build
// time by vite.config.ts.
const version = __APP_VERSION__
const buildDate = __BUILD_DATE__
// Copyright year comes from the build date itself, so it updates on its own.
const year = buildDate.slice(0, 4)
</script>

<template>
  <footer class="footer">
    <span class="copy">© {{ year }} TechShock D.S. LLC · All rights reserved</span>
    <span class="build">v{{ version }} · {{ buildDate }}</span>
  </footer>
</template>

<style scoped>
.footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.7rem 1.5rem;
  border-top: 1px solid var(--border);
  background-color: var(--bg-surface);
  color: var(--text-muted);
  font-size: 0.68rem;
  text-align: center;
}

.copy {
  letter-spacing: 0.01em;
}

.build {
  font-family: var(--font-mono);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
</style>
