<script setup lang="ts">
import { computed, onUnmounted, ref, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useApi } from "../composables/api";
import { usePiStore } from "../stores/pi";
import {
  Network, ArrowUp, Clock, Shield, ShieldAlert, Wifi, Unplug,
  House, Server, BrickWall, Container, Fan, ChartLine, LayoutGrid,
} from "lucide-vue-next";
import AppFooter from "../components/AppFooter.vue";
import { useAlerts } from "../composables/alerts";

const { connect, disconnect } = useApi();
const store = usePiStore();

const navItems = [
  { to: { name: "home" },     label: "Home",     icon: House },
  { to: { name: "history" },  label: "History",  icon: ChartLine },
  { to: { name: "services" }, label: "Services", icon: Server },
  { to: { name: "ufw" },      label: "UFW",      icon: BrickWall },
  { to: { name: "docker" },   label: "Docker",   icon: Container },
  { to: { name: "pironman" }, label: "Pironman", icon: Fan },
  { to: { name: "apps" },     label: "Apps",     icon: LayoutGrid },
];

// Swipe between tabs on touch screens, in menu order.
const route = useRoute();
const router = useRouter();
const tabIndex = computed(() => navItems.findIndex((i) => i.to.name === route.name));

// Pages slide in from the side they come from, whether by swipe or menu tap.
const slide = ref("slide-left");
watch(tabIndex, (to, from) => {
  slide.value = to >= 0 && from >= 0 && to < from ? "slide-right" : "slide-left";
});

const SWIPE_MIN_PX = 70;
const SWIPE_MAX_MS = 600;
let touch: { x: number; y: number; t: number } | null = null;

// Don't steal a swipe from things that move sideways on their own: inputs and
// sliders, the menu, and anything that scrolls horizontally (the UFW table).
function swipeBlocked(el: EventTarget | null): boolean {
  for (let n = el as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
    if (n.matches("input, select, textarea, button, a, [data-no-swipe]")) return true;
    if (n.scrollWidth > n.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true;
  }
  return false;
}

function onTouchStart(e: TouchEvent) {
  touch = e.touches.length === 1 && !swipeBlocked(e.target)
    ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
    : null;
}

function onTouchEnd(e: TouchEvent) {
  if (!touch || tabIndex.value < 0) return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  const quick = Date.now() - touch.t < SWIPE_MAX_MS;
  touch = null;
  // Mostly horizontal, long enough, and quick — otherwise it was a scroll.
  if (!quick || Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dy) > Math.abs(dx) * 0.5) return;
  const next = tabIndex.value + (dx < 0 ? 1 : -1);
  if (next >= 0 && next < navItems.length) router.push(navItems[next].to);
}

// Browser tab: "(3) Pi Dash" and a red/amber dot on the icon while
// there are alerts, so it's visible from another tab.
const { alerts, errorCount } = useAlerts();
const baseTitle = document.title;
const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
const iconUrl = (name: string) => `${import.meta.env.BASE_URL}${name}`;

watchEffect(() => {
  const n = alerts.value.length;
  document.title = n ? `(${n}) ${baseTitle}` : baseTitle;
  if (iconLink) {
    iconLink.href = iconUrl(
      errorCount.value ? "favicon-error.svg" : n ? "favicon-warn.svg" : "favicon.svg"
    );
  }
});

onUnmounted(() => {
  document.title = baseTitle;
  if (iconLink) iconLink.href = iconUrl("favicon.svg");
});

const piOffline = computed(() => store.piOnline === false);

const enabled = computed(() => store.status !== "disconnected")

const wgColor  = computed(() => Number(store.fastData.wg_active ?? 0) > 0  ? "#38bdf8" : "var(--text-muted)")
const f2bColor = computed(() => (store.slowData.f2b_bans  ?? 0) > 0  ? "#fb923c" : "var(--text-muted)")
const csColor  = computed(() => (store.slowData.cs_bans   ?? 0) > 0  ? "#fb923c" : "var(--text-muted)");

function formatTime(ts: string | number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], { hour12: false });
}

function toggle() {
  if (enabled.value) {
    disconnect();
  } else {
    connect();
  }
}
</script>

<template>
  <div class="layout">
    <header class="header">
      <!-- Left: title + IP -->
      <div class="header-left">
        <span class="title">Pi Dash</span>
        <span class="subtitle">
          <Network :size="11" />
          {{ store.fastData.ip ?? "—" }}
        </span>
      </div>

      <!-- Center: stats -->
      <div class="header-center" :class="{ stale: piOffline }">
        <div class="stat">
          <span class="stat-label"><ArrowUp :size="11" /> uptime</span>
          <span class="stat-value">{{ store.fastData.uptime ?? "—" }}</span>
        </div>
        <div class="stat-divider" />
        <div class="stat">
          <span class="stat-label"><Clock :size="11" /> time</span>
          <span class="stat-value">{{ formatTime(store.fastData.timestamp) }}</span>
        </div>
        <div class="stat-divider" />
        <div class="stat">
          <span class="stat-label"><Wifi :size="11" /> WireGuard</span>
          <span class="stat-value" :style="{ color: wgColor }">
            {{ store.fastData.wg_active ?? "—" }} / {{ store.fastData.wg_total ?? "—" }}
          </span>
        </div>
        <div class="stat-divider" />
        <div class="stat">
          <span class="stat-label"><ShieldAlert :size="11" /> F2B</span>
          <span class="stat-value" :style="{ color: f2bColor }">{{ store.slowData.f2b_bans ?? "—" }}</span>
        </div>
        <div class="stat-divider" />
        <div class="stat">
          <span class="stat-label"><Shield :size="11" /> CrowdSec</span>
          <span class="stat-value" :style="{ color: csColor }">{{ store.slowData.cs_bans ?? "—" }}</span>
        </div>
      </div>

      <!-- Right: status + toggle -->
      <div class="header-right">
        <div class="status-wrap">
          <span class="dot" :class="store.status" />
        </div>
        <label class="toggle-wrap">
          <input type="checkbox" :checked="enabled" @change="toggle" />
          <span class="slider"></span>
        </label>
      </div>
    </header>
    <nav class="nav">
      <RouterLink
        v-for="item in navItems"
        :key="item.label"
        :to="item.to"
        class="nav-link"
        exact-active-class="active"
      >
        <component :is="item.icon" :size="14" />
        {{ item.label }}
      </RouterLink>
    </nav>
    <div v-if="piOffline" class="offline-banner">
      <Unplug :size="14" />
      <span>Pi unreachable — the numbers below are the last ones it sent and may be out of date.</span>
    </div>
    <main
      class="content"
      :class="{ 'pi-offline': piOffline }"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <RouterView v-slot="{ Component }">
        <Transition :name="slide" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>
    <AppFooter />
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  min-height: 100dvh; /* phones: the visible height, not counting the URL bar */
  display: flex;
  flex-direction: column;
  background-color: var(--bg);
}

.header {
  background-color: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  padding: 0 1.5rem;
  height: 64px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
}

/* Left */
.header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.02em;
}

.subtitle {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

/* Center */
.header-center {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-label {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.6rem;
  font-family: var(--font-mono);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 0.8rem;
  font-family: var(--font-mono);
  color: var(--text);
  font-weight: 500;
}


.stat-divider {
  width: 1px;
  height: 28px;
  background-color: var(--border);
}

/* Right */
.header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
}

.status-wrap {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.status-label {
  font-size: 0.7rem;
  font-family: var(--font-mono);
}

.status-label.connected {
  color: var(--success);
}
.status-label.connecting {
  color: var(--warning);
}
.status-label.disconnected {
  color: var(--error);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot.connected {
  background-color: var(--success);
  box-shadow: 0 0 6px var(--success);
}

.dot.connecting {
  background-color: var(--warning);
  box-shadow: 0 0 6px var(--warning);
  animation: pulse 1s infinite;
}

.dot.disconnected {
  background-color: var(--error);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* Toggle */
.toggle-wrap {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.toggle-wrap input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  inset: 0;
  background-color: var(--border);
  border-radius: 24px;
  transition: background-color 0.2s;
}

.slider::before {
  content: "";
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  top: 3px;
  background-color: var(--text-muted);
  border-radius: 50%;
  transition: transform 0.2s, background-color 0.2s;
}

.toggle-wrap input:checked + .slider {
  background-color: var(--primary-muted);
}

.toggle-wrap input:checked + .slider::before {
  transform: translateX(20px);
  background-color: var(--primary);
}

/* Pi offline: say so, and grey out every figure that came from it. */
.offline-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.55rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border-bottom: 1px solid rgba(239, 68, 68, 0.25);
  color: #ef4444;
  font-size: 0.75rem;
  text-align: center;
}

.stale,
.pi-offline :deep(.card:not(.alerts-card)) {
  opacity: 0.4;
  filter: grayscale(0.7);
  transition: opacity 0.3s, filter 0.3s;
}

/* Page change: a short slide from the side the new tab is on. */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.slide-left-enter-from,
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

.slide-left-leave-to,
.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}

@media (prefers-reduced-motion: reduce) {
  .slide-left-enter-active,
  .slide-left-leave-active,
  .slide-right-enter-active,
  .slide-right-leave-active {
    transition: none;
  }
}

/* Nav */
.nav {
  background-color: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  padding: 0 1.5rem;
  display: flex;
  gap: 0.25rem;
  overflow-x: auto;
  scrollbar-width: none;
}

/* Auto margins centre the links but, unlike justify-content: center, still let
   the first one scroll into view when they don't fit. */
.nav-link:first-child {
  margin-left: auto;
}

.nav-link:last-child {
  margin-right: auto;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.9rem;
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--text-muted);
  text-decoration: none;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
}

.nav-link:hover {
  color: var(--text);
}

.nav-link.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  overflow-x: hidden; /* keeps the slide animation from adding a scrollbar */
}

/* Tablet and below: the page already has its own padding, don't double it. */
@media (max-width: 900px) {
  .content {
    padding: 0;
  }
}

/* Phone: title and connection on one row, the stats on a second row below. */
@media (max-width: 760px) {
  .header {
    height: auto;
    padding: 0.6rem 1rem;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "left right"
      "center center";
    row-gap: 0.6rem;
  }

  .header-left { grid-area: left; }
  .header-right { grid-area: right; }

  /* Five equal columns, no icons in the labels, so all stats fit on a phone. */
  .header-center {
    grid-area: center;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.25rem;
  }

  .stat-divider,
  .stat-label svg {
    display: none;
  }

  .stat-label {
    font-size: 0.55rem;
  }

  .stat-value {
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .nav {
    padding: 0 0.5rem;
  }
}

/* Narrow phones: drop the menu icons so all five tabs fit without scrolling. */
@media (max-width: 420px) {
  .nav-link {
    padding: 0.6rem 0.55rem;
  }

  .nav-link svg {
    display: none;
  }

  .content {
    padding: 0;
  }
}
</style>
