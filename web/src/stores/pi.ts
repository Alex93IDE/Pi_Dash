import { defineStore } from "pinia";
import type {
  DockerContainer,
  FastData,
  Hello,
  SlowData,
  SystemdService,
  UnitAction,
  UnitSource,
} from "../../../shared/types";

export type { DockerContainer, SystemdService, UfwRule } from "../../../shared/types";
export type FavoriteSource = UnitSource;

// Every field is null until the first message carrying it arrives.
type Pending<T> = { [K in keyof T]: T[K] | null };

export const favoriteKey = (source: FavoriteSource, name: string) => `${source}:${name}`;

export type NetSample = { rx: number; tx: number };

// One sample per fast message (≈1 s), so these hold the last minute.
const HISTORY = 60;

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

const emptyFast: Pending<FastData> = {
  cpu_pct: null,
  cpu_freq: null,
  cpu_temp: null,
  cpu_cores: null,
  load_avg: null,
  fan_rpm: null,
  ram_used: null,
  ram_total: null,
  ram_pct: null,
  disk_used: null,
  disk_total: null,
  disk_pct: null,
  ip: null,
  net_iface: null,
  net_rx: null,
  net_tx: null,
  uptime: null,
  wg_active: null,
  wg_total: null,
  timestamp: null,
  oled_enable: null,
  rgb_enable: null,
  rgb_color: null,
  rgb_brightness: null,
  rgb_speed: null,
  rgb_style: null,
  fan_mode: null,
};

const emptySlow: Pending<SlowData> = {
  nvme_temp: null,
  nvme_spare: null,
  nvme_used: null,
  nvme_hours: null,
  nvme_unsafe: null,
  nvme_errors: null,
  f2b_bans: null,
  cs_bans: null,
  ufw_status: null,
  ufw_rules: null,
};

export const usePiStore = defineStore("pi", {
  state: () => ({
    status: "disconnected" as ConnectionStatus,
    // Whether the Pi is answering. null until the first connection attempt
    // settles. While false, everything below is the last thing it sent.
    piOnline: null as boolean | null,
    // When the last fast message arrived, by this browser's clock — so a
    // clock or timezone mismatch with the Pi can't fake a stale alert.
    fastReceivedAt: null as number | null,
    server: null as Hello | null,
    netHistory: [] as NetSample[],
    ramHistory: [] as number[],
    fastData: { ...emptyFast },
    slowData: { ...emptySlow },
    // null until the first list arrives; [] means "none".
    services: null as SystemdService[] | null,
    docker: null as DockerContainer[] | null,
    // Favorite toggles sent but not yet confirmed, keyed by favoriteKey() and
    // holding the requested value. The server confirms by sending the list again.
    pendingFavorites: {} as Record<string, boolean>,
    // Start/stop/restart requests in flight, keyed by favoriteKey().
    pendingActions: {} as Record<string, UnitAction>,
  }),
  actions: {
    setFastData(data: FastData) {
      this.fastData = { ...this.fastData, ...data };
      this.fastReceivedAt = Date.now();
      this.netHistory = [...this.netHistory, { rx: data.net_rx, tx: data.net_tx }].slice(-HISTORY);
      this.ramHistory = [...this.ramHistory, data.ram_pct].slice(-HISTORY);
    },
    setSlowData(data: SlowData) {
      this.slowData = { ...this.slowData, ...data };
    },
    setServices(list: SystemdService[]) {
      this.services = list;
      this.settleFavorites("systemd", list);
    },
    setDocker(list: DockerContainer[]) {
      this.docker = list;
      this.settleFavorites("docker", list);
    },
    markFavoritePending(source: FavoriteSource, name: string, value: boolean) {
      this.pendingFavorites[favoriteKey(source, name)] = value;
    },
    clearFavoritePending(source: FavoriteSource, name: string) {
      delete this.pendingFavorites[favoriteKey(source, name)];
    },
    settleFavorites(source: FavoriteSource, list: { name: string; favorite: boolean }[]) {
      for (const item of list) {
        const key = favoriteKey(source, item.name);
        if (this.pendingFavorites[key] === item.favorite) delete this.pendingFavorites[key];
      }
    },
    setStatus(status: ConnectionStatus) {
      this.status = status;
      if (status === "connected") this.piOnline = true;
      // Lost after having had it: the Pi (or the network to it) went away.
      else if (status === "connecting" && this.piOnline) this.piOnline = false;
      else if (status === "disconnected") this.piOnline = null;
    },
  },
});
