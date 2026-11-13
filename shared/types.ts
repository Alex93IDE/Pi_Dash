// What the server sends and accepts. Both server/ and web/ import this file,
// so a field renamed here breaks the build on both sides instead of silently
// showing "—" on the dashboard.

export type UfwRule = {
  num: number;
  to: string;
  action: string;
  from: string;
};

/** Every second: system metrics and the Pironman5 case state. */
export type FastData = {
  cpu_pct: number;
  cpu_freq: number; // MHz
  cpu_temp: number; // °C
  cpu_cores: number[]; // % per core
  load_avg: [number, number, number]; // 1, 5, 15 min
  fan_rpm: number;
  ram_used: number; // MB
  ram_total: number; // MB
  ram_pct: number;
  disk_used: number; // GB
  disk_total: number; // GB
  disk_pct: number;
  ip: string;
  net_iface: string;
  net_rx: number; // bytes/s
  net_tx: number; // bytes/s
  uptime: string;
  wg_active: number;
  wg_total: number;
  timestamp: string; // ISO 8601, UTC

  oled_enable: boolean;
  rgb_enable: boolean;
  rgb_color: string;
  rgb_brightness: number;
  rgb_speed: number;
  rgb_style: string;
  fan_mode: number;
};

/** Every 30 seconds: NVMe health, bans and the firewall. */
export type SlowData = {
  // The NVMe fields come straight out of smartctl, so they can be strings
  // like "100%" or "3,234" rather than plain numbers, or "?" when missing.
  nvme_temp: string | number;
  nvme_spare: string | number;
  nvme_used: string | number;
  nvme_hours: string | number;
  nvme_unsafe: string | number;
  nvme_errors: string | number;
  f2b_bans: number;
  cs_bans: number;
  ufw_status: string;
  ufw_rules: UfwRule[];
};

export type SystemdService = {
  name: string;
  active: string; // active | inactive | failed | activating | deactivating | reloading
  sub: string; // running, exited, dead, failed, auto-restart…
  // Unit file state: enabled | disabled | static | masked | indirect | generated …
  // "" when the unit has no unit file. Informational only — never an error.
  enabled: string;
  description: string;
  favorite: boolean;
};

export type DockerContainer = {
  name: string;
  image: string;
  state: string; // running | exited | paused | restarting | created | dead
  status: string; // Docker's own human-readable text, shown as-is
  favorite: boolean;
};

export type UnitSource = "systemd" | "docker";
export const UNIT_ACTIONS = ["start", "stop", "restart"] as const;
export type UnitAction = (typeof UNIT_ACTIONS)[number];

/** A link to something else running on the Pi (Keeper, WGDashboard…). */
export type App = {
  id: number;
  name: string;
  // May contain {host}, replaced in the browser with the host the dashboard
  // was opened on — so one entry works over LAN, VPN or a hostname alike.
  url: string;
  description: string;
};
export type AppInput = Omit<App, "id">;

/** Sent once on every (re)connection of the event stream. */
export type Hello = {
  version: string;
  unitControl: boolean; // start/stop/restart enabled in .env
  protectedUnits: string[]; // can be restarted but never stopped
};

export const HISTORY_RANGES = ["1h", "24h", "7d", "30d"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

/** One bucket of history: averages, except the *_max fields. */
export type HistoryPoint = {
  ts: number; // bucket start, ms since epoch
  cpu: number;
  cpu_max: number;
  temp: number;
  temp_max: number;
  ram: number;
  disk: number;
  rx: number; // bytes/s
  tx: number; // bytes/s
};

/** Server-sent event names and their payloads. */
export type StreamEvents = {
  hello: Hello;
  fast: FastData;
  slow: SlowData;
  services: SystemdService[];
  docker: DockerContainer[];
};

// Pironman5 case commands, validated on the server.
export const RGB_STYLES = [
  "solid",
  "breathing",
  "flow",
  "flow_reverse",
  "rainbow",
  "rainbow_reverse",
  "hue_cycle",
] as const;

export type PironmanCommand =
  | { action: "oled_on" | "oled_off" | "rgb_on" | "rgb_off" }
  | { action: "rgb_color"; color: string }
  | { action: "rgb_style"; style: string }
  | { action: "rgb_brightness" | "rgb_speed"; value: number }
  | { action: "fan_mode"; mode: number }; // 0=Always On, 1=Performance, 2=Cool, 3=Balance, 4=Silent
