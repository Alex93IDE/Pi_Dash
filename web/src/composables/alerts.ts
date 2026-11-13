import { computed, onMounted, onUnmounted, ref } from "vue";
import { usePiStore } from "../stores/pi";
import { computeAlerts, sortAlerts, type Alert } from "../../../shared/alerts";

export type { Alert } from "../../../shared/alerts";

// The fast topic arrives every second; this long without one means the
// collector on the Pi has stalled, even though the connection is up.
const STALE_MS = 15_000;

/**
 * Everything on the Pi that needs attention, errors first. Shared by the
 * Alerts card and the browser tab title so both follow the same rules. The
 * rules themselves live in shared/alerts.ts, which Telegram uses too; only
 * the connection ones are the browser's own.
 */
export function useAlerts() {
  const store = usePiStore();

  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval>;
  onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 5_000)));
  onUnmounted(() => clearInterval(timer));

  const alerts = computed<Alert[]>(() => {
    const list: Alert[] = [];

    // Connection
    if (store.status === "disconnected") {
      list.push({ key: "live", level: "error", title: "Live data", detail: "paused — data below may be stale" });
    } else if (store.piOnline === false) {
      // Everything else would be judged on the values from before the Pi
      // went away, so it's the only alert worth showing.
      return [{ key: "pi", level: "error", title: "Pi", detail: "unreachable — showing its last known values" }];
    } else if (store.status === "connected" && store.fastReceivedAt) {
      const age = now.value - store.fastReceivedAt;
      if (age > STALE_MS) {
        list.push({ key: "stale", level: "warn", title: "Metrics", detail: `none for ${Math.round(age / 1000)} s` });
      }
    }

    list.push(
      ...computeAlerts({
        fast: store.fastData,
        slow: store.slowData,
        services: store.services,
        docker: store.docker,
        apps: Object.values(store.appStatus),
        adguard: store.adguard,
      }),
    );
    return sortAlerts(list);
  });

  const errorCount = computed(() => alerts.value.filter((a) => a.level === "error").length);

  return { alerts, errorCount };
}
