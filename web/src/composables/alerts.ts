import { computed, onMounted, onUnmounted, ref } from "vue";
import { usePiStore } from "../stores/pi";
import { toNumber } from "../utils/number";

export type Alert = {
  level: "error" | "warn";
  title: string;
  detail: string;
  to?: string; // route name to jump to
};

// The fast topic arrives every second; this long without one means the
// collector on the Pi has stalled, even though the connection is up.
const STALE_MS = 15_000;

/**
 * Everything on the Pi that needs attention, errors first. Shared by the
 * Alerts card and the browser tab title so both follow the same rules.
 */
export function useAlerts() {
  const store = usePiStore();

  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval>;
  onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 5_000)));
  onUnmounted(() => clearInterval(timer));

  const alerts = computed<Alert[]>(() => {
    const list: Alert[] = [];
    const fast = store.fastData;
    const slow = store.slowData;

    // Connection
    if (store.status === "disconnected") {
      list.push({ level: "error", title: "Live data", detail: "paused — data below may be stale" });
    } else if (store.piOnline === false) {
      // Everything else would be judged on the values from before the Pi
      // went away, so it's the only alert worth showing.
      return [{ level: "error", title: "Pi", detail: "unreachable — showing its last known values" }];
    } else if (store.status === "connected" && store.fastReceivedAt) {
      const age = now.value - store.fastReceivedAt;
      if (age > STALE_MS) {
        list.push({ level: "warn", title: "Metrics", detail: `none for ${Math.round(age / 1000)} s` });
      }
    }

    // systemd: "failed" is always an error; "inactive" only matters for the
    // units you starred — for the rest it's normal (oneshots, missing hardware…).
    for (const svc of store.services ?? []) {
      const title = svc.name.replace(/\.service$/, "");
      if (svc.active === "failed") {
        list.push({ level: "error", title, detail: `failed · ${svc.sub}`, to: "services" });
      } else if (svc.favorite && svc.active !== "active") {
        list.push({ level: "error", title, detail: `${svc.active} · ${svc.sub}`, to: "services" });
      }
    }

    // Docker: a container that isn't running is worth a look; dead, restarting
    // or a starred one down is an error.
    for (const c of store.docker ?? []) {
      if (c.state === "running") continue;
      const serious = c.favorite || c.state === "dead" || c.state === "restarting";
      list.push({ level: serious ? "error" : "warn", title: c.name, detail: c.status, to: "docker" });
    }

    // Firewall
    if (slow.ufw_status && slow.ufw_status !== "active") {
      list.push({ level: "error", title: "UFW", detail: `firewall ${slow.ufw_status}`, to: "ufw" });
    }

    // Hardware — same red thresholds the cards use.
    const cpuTemp = fast.cpu_temp;
    if (cpuTemp !== null && cpuTemp >= 80) {
      list.push({ level: "warn", title: "CPU", detail: `temperature ${cpuTemp.toFixed(0)} °C` });
    }
    if (fast.ram_pct !== null && fast.ram_pct >= 90) {
      list.push({ level: "warn", title: "RAM", detail: `${fast.ram_pct.toFixed(0)} % used` });
    }
    if (fast.disk_pct !== null && fast.disk_pct >= 90) {
      list.push({ level: "warn", title: "Disk", detail: `${fast.disk_pct.toFixed(0)} % full` });
    }

    const nvmeTemp = toNumber(slow.nvme_temp);
    if (nvmeTemp !== null && nvmeTemp >= 70) {
      list.push({ level: "warn", title: "NVMe", detail: `temperature ${nvmeTemp} °C` });
    }
    const nvmeSpare = toNumber(slow.nvme_spare);
    if (nvmeSpare !== null && nvmeSpare <= 10) {
      list.push({ level: "error", title: "NVMe", detail: `spare capacity ${nvmeSpare} %` });
    }
    const nvmeUsed = toNumber(slow.nvme_used);
    if (nvmeUsed !== null && nvmeUsed >= 90) {
      list.push({ level: "warn", title: "NVMe", detail: `wear ${nvmeUsed} %` });
    }
    const nvmeErrors = toNumber(slow.nvme_errors);
    if (nvmeErrors !== null && nvmeErrors > 0) {
      list.push({ level: "error", title: "NVMe", detail: `${nvmeErrors} media errors` });
    }

    // Errors first, otherwise keep the order above.
    return list.sort((a, b) => Number(b.level === "error") - Number(a.level === "error"));
  });

  const errorCount = computed(() => alerts.value.filter((a) => a.level === "error").length);

  return { alerts, errorCount };
}
