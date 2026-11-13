import { readFileSync } from "node:fs";
import path from "node:path";

// The repo root: .env, data/ and web/dist live here, two levels above this file.
export const ROOT = path.resolve(import.meta.dirname, "../..");

try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  // No .env: run on the defaults below.
}

const env = (key: string, fallback: string) => process.env[key] ?? fallback;
const num = (key: string, fallback: number) => {
  const n = Number(process.env[key]);
  return process.env[key] && Number.isFinite(n) ? n : fallback;
};
const list = (key: string, fallback: string) =>
  env(key, fallback).split(",").map((s) => s.trim()).filter(Boolean);

export const VERSION: string = JSON.parse(
  readFileSync(path.join(ROOT, "package.json"), "utf8"),
).version;

// 0.0.0.0 listens on every interface.
export const HOST = env("HOST", "0.0.0.0");
export const PORT = num("PORT", 3010);
export const WEB_ROOT = path.join(ROOT, "web", "dist");
export const DATA_DIR = path.resolve(ROOT, env("DATA_DIR", "data"));

export const INTERVAL_FAST = num("INTERVAL_FAST", 1) * 1000;
export const INTERVAL_SLOW = num("INTERVAL_SLOW", 30) * 1000;
// CPU and RAM per container. Only collected while someone is watching.
export const INTERVAL_DOCKER_STATS = num("INTERVAL_DOCKER_STATS", 10) * 1000;
export const HISTORY_DAYS = num("HISTORY_DAYS", 30);

export const PIRONMAN_API = env("PIRONMAN_API", "http://localhost:34001/api/v1.0");

// Interface to measure throughput on. Empty follows the default route.
export const NET_INTERFACE = env("NET_INTERFACE", "");

// Host-specific bits. Leave any of these empty to skip that metric entirely.
export const WG_INTERFACE = env("WG_INTERFACE", "wg0");
export const NVME_DEVICE = env("NVME_DEVICE", "/dev/nvme0");
export const F2B_JAIL = env("F2B_JAIL", "sshd");
export const FAN_INPUT = env("FAN_INPUT", "/sys/class/hwmon/hwmon0/fan1_input");
export const CS_ENABLE = env("CS_ENABLE", "false").toLowerCase() === "true";

// Start/stop/restart of systemd units and Docker containers from the browser.
export const UNIT_CONTROL = env("UNIT_CONTROL", "true").toLowerCase() === "true";
// Units that can be restarted but never stopped from the dashboard — stopping
// ssh or the dashboard itself would lock you out of the very tool to undo it.
export const PROTECTED_UNITS = list("PROTECTED_UNITS", "ssh.service,pi-dash.service");
