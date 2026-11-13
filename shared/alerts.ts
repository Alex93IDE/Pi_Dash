// What on the Pi needs attention. The browser shows these on the Alerts card
// and in the tab title; the server sends them to Telegram. One set of rules,
// so both always agree.
import type {
  AdGuardData,
  AppStatus,
  DockerContainer,
  PowerState,
  SystemdService,
} from "./types.ts";

export type Alert = {
  // Stable while the same problem lasts, even if the detail changes
  // ("temperature 81 °C" -> "82 °C"), so a notification isn't repeated.
  key: string;
  level: "error" | "warn";
  title: string;
  detail: string;
  to?: string; // dashboard route name to jump to
};

/** The latest of each payload; null for what hasn't arrived yet. */
export type AlertInput = {
  fast: { cpu_temp: number | null; ram_pct: number | null; disk_pct: number | null };
  slow: {
    nvme_temp: string | number | null;
    nvme_spare: string | number | null;
    nvme_used: string | number | null;
    nvme_errors: string | number | null;
    ufw_status: string | null;
    power: PowerState | null;
  };
  services: SystemdService[] | null;
  docker: DockerContainer[] | null;
  apps: AppStatus[];
  adguard: AdGuardData | null | undefined;
};

// SMART values arrive as smartctl prints them — "100%", "3,234", sometimes "?"
// when the drive didn't answer. Strip everything that isn't part of the number
// before comparing or doing arithmetic on them.
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(cleaned) ? cleaned : null;
}

/** Every problem in the data, errors first. */
export function computeAlerts({ fast, slow, services, docker, apps, adguard }: AlertInput): Alert[] {
  const list: Alert[] = [];

  // systemd: "failed" is always an error; "inactive" only matters for the
  // units you starred — for the rest it's normal (oneshots, missing hardware…).
  for (const svc of services ?? []) {
    const title = svc.name.replace(/\.service$/, "");
    const key = `systemd:${svc.name}`;
    if (svc.active === "failed") {
      list.push({ key, level: "error", title, detail: `failed · ${svc.sub}`, to: "services" });
    } else if (svc.favorite && svc.active !== "active") {
      list.push({ key, level: "error", title, detail: `${svc.active} · ${svc.sub}`, to: "services" });
    }
  }

  // Docker: a container that isn't running is worth a look; dead, restarting
  // or a starred one down is an error.
  for (const c of docker ?? []) {
    if (c.state === "running") continue;
    const serious = c.favorite || c.state === "dead" || c.state === "restarting";
    list.push({ key: `docker:${c.name}`, level: serious ? "error" : "warn", title: c.name, detail: c.status, to: "docker" });
  }

  // Apps that stopped answering the server's check.
  for (const a of apps) {
    if (!a.up) list.push({ key: `app:${a.id}`, level: "warn", title: a.name, detail: `app down · ${a.error}`, to: "apps" });
  }

  // Power: under-voltage is the Pi's most common silent problem — it slows
  // down (or corrupts the disk) without saying a word.
  const p = slow.power;
  if (p?.undervoltage) {
    list.push({ key: "power:now", level: "error", title: "Power", detail: "under-voltage now — check the power supply" });
  } else if (p?.undervoltage_seen) {
    list.push({ key: "power:seen", level: "warn", title: "Power", detail: "under-voltage happened since boot" });
  }
  if (p && (p.throttled || p.capped)) {
    list.push({ key: "cpu:throttled", level: "warn", title: "CPU", detail: p.soft_temp ? "throttled — too hot" : "throttled" });
  }

  // AdGuard, when configured.
  if (adguard && !adguard.ok) {
    list.push({ key: "adguard:down", level: "warn", title: "AdGuard", detail: adguard.error ?? "not answering" });
  } else if (adguard && !adguard.protection) {
    list.push({ key: "adguard:off", level: "warn", title: "AdGuard", detail: "protection is disabled" });
  }

  // Firewall
  if (slow.ufw_status && slow.ufw_status !== "active") {
    list.push({ key: "ufw", level: "error", title: "UFW", detail: `firewall ${slow.ufw_status}`, to: "ufw" });
  }

  // Hardware — same red thresholds the cards use.
  if (fast.cpu_temp !== null && fast.cpu_temp >= 80) {
    list.push({ key: "cpu:temp", level: "warn", title: "CPU", detail: `temperature ${fast.cpu_temp.toFixed(0)} °C` });
  }
  if (fast.ram_pct !== null && fast.ram_pct >= 90) {
    list.push({ key: "ram", level: "warn", title: "RAM", detail: `${fast.ram_pct.toFixed(0)} % used` });
  }
  if (fast.disk_pct !== null && fast.disk_pct >= 90) {
    list.push({ key: "disk", level: "warn", title: "Disk", detail: `${fast.disk_pct.toFixed(0)} % full` });
  }

  const nvmeTemp = toNumber(slow.nvme_temp);
  if (nvmeTemp !== null && nvmeTemp >= 70) {
    list.push({ key: "nvme:temp", level: "warn", title: "NVMe", detail: `temperature ${nvmeTemp} °C` });
  }
  const nvmeSpare = toNumber(slow.nvme_spare);
  if (nvmeSpare !== null && nvmeSpare <= 10) {
    list.push({ key: "nvme:spare", level: "error", title: "NVMe", detail: `spare capacity ${nvmeSpare} %` });
  }
  const nvmeUsed = toNumber(slow.nvme_used);
  if (nvmeUsed !== null && nvmeUsed >= 90) {
    list.push({ key: "nvme:wear", level: "warn", title: "NVMe", detail: `wear ${nvmeUsed} %` });
  }
  const nvmeErrors = toNumber(slow.nvme_errors);
  if (nvmeErrors !== null && nvmeErrors > 0) {
    list.push({ key: "nvme:errors", level: "error", title: "NVMe", detail: `${nvmeErrors} media errors` });
  }

  return sortAlerts(list);
}

/** Errors first, otherwise keep the order given. */
export const sortAlerts = (list: Alert[]) =>
  list.sort((a, b) => Number(b.level === "error") - Number(a.level === "error"));
