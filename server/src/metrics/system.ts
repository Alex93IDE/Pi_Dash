// CPU, memory, disk, network and uptime — cheap enough to read every second.
import os from "node:os";
import { statfs } from "node:fs/promises";
import { FAN_INPUT, NET_INTERFACE } from "../config.ts";
import { readText } from "../shell.ts";

const round = (n: number, digits = 1) => Number(n.toFixed(digits));

export function formatUptime(seconds: number): string {
  const s = Math.floor(seconds);
  const days = Math.floor(s / 86400);
  const hrs = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  return `${days}d ${hrs}h ${mins}m`;
}

/** Interface of the default route, from /proc/net/route contents. */
export function defaultRouteInterface(routeTable: string): string {
  for (const line of routeTable.split("\n").slice(1)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length > 1 && fields[1] === "00000000") return fields[0];
  }
  return "";
}

/** /proc/net/dev contents -> bytes received and sent per interface. */
export function parseNetDev(text: string): Map<string, { rx: number; tx: number }> {
  const out = new Map<string, { rx: number; tx: number }>();
  for (const line of text.split("\n").slice(2)) {
    const [name, rest] = line.split(":");
    if (!rest) continue;
    const f = rest.trim().split(/\s+/).map(Number);
    out.set(name.trim(), { rx: f[0], tx: f[8] });
  }
  return out;
}

// ── CPU ──────────────────────────────────────────────────
// Usage needs two samples, so the previous one lives between calls.
type CpuTimes = { idle: number; total: number };
let cpuPrev: CpuTimes[] | null = null;

function cpuTimes(): CpuTimes[] {
  return os.cpus().map(({ times: t }) => ({
    idle: t.idle,
    total: t.user + t.nice + t.sys + t.idle + t.irq,
  }));
}

/** [overall %, per-core %] since the previous call. */
export function cpuUsage(prev: CpuTimes[] | null, now: CpuTimes[]): [number, number[]] {
  if (!prev || prev.length !== now.length) return [0, now.map(() => 0)];
  const pct = (idle: number, total: number) => (total > 0 ? round(100 * (1 - idle / total)) : 0);
  let idle = 0;
  let total = 0;
  const cores = now.map((c, i) => {
    const di = c.idle - prev[i].idle;
    const dt = c.total - prev[i].total;
    idle += di;
    total += dt;
    return pct(di, dt);
  });
  return [pct(idle, total), cores];
}

// ── Network throughput ───────────────────────────────────
let netPrev: { iface: string; at: number; rx: number; tx: number } | null = null;

async function netRates(): Promise<[string, number, number]> {
  const iface = NET_INTERFACE || defaultRouteInterface(await readText("/proc/net/route"));
  const counters = parseNetDev(await readText("/proc/net/dev")).get(iface);
  if (!counters) {
    netPrev = null;
    return [iface, 0, 0];
  }
  const now = performance.now();
  const prev = netPrev;
  netPrev = { iface, at: now, ...counters };
  // First call, or the default route moved to another interface.
  if (!prev || prev.iface !== iface || now <= prev.at) return [iface, 0, 0];

  const elapsed = (now - prev.at) / 1000;
  return [
    iface,
    Math.round(Math.max(0, counters.rx - prev.rx) / elapsed),
    Math.round(Math.max(0, counters.tx - prev.tx) / elapsed),
  ];
}

function ipOf(iface: string): string {
  const all = os.networkInterfaces();
  const candidates = [...(all[iface] ?? []), ...Object.values(all).flat()];
  return candidates.find((a) => a && a.family === "IPv4" && !a.internal)?.address ?? "?.?.?.?";
}

async function cpuTemp(): Promise<number> {
  const milli = Number(await readText("/sys/class/thermal/thermal_zone0/temp"));
  return milli > 0 ? round(milli / 1000) : 0;
}

async function cpuFreq(): Promise<number> {
  const khz = Number(await readText("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq"));
  return khz > 0 ? round(khz / 1000) : (os.cpus()[0]?.speed ?? 0);
}

export async function collect() {
  const times = cpuTimes();
  const [cpu_pct, cpu_cores] = cpuUsage(cpuPrev, times);
  cpuPrev = times;

  // os.freemem() is MemAvailable on Linux: what programs can still get,
  // page cache included — the number that matters.
  const total = os.totalmem();
  const used = total - os.freemem();

  let disk_used = 0;
  let disk_total = 0;
  try {
    const fs = await statfs("/");
    disk_total = fs.blocks * fs.bsize;
    disk_used = disk_total - fs.bfree * fs.bsize;
  } catch {
    // leave at zero
  }

  const rpm = FAN_INPUT ? await readText(FAN_INPUT) : "";
  const [net_iface, net_rx, net_tx] = await netRates();
  const load = os.loadavg();

  return {
    cpu_pct,
    cpu_cores,
    cpu_freq: await cpuFreq(),
    load_avg: [round(load[0], 2), round(load[1], 2), round(load[2], 2)] as [number, number, number],
    cpu_temp: await cpuTemp(),
    ram_pct: total ? round((100 * used) / total) : 0,
    ram_used: Math.floor(used / 1024 ** 2),
    ram_total: Math.floor(total / 1024 ** 2),
    disk_pct: disk_total ? round((100 * disk_used) / disk_total) : 0,
    disk_used: round(disk_used / 1024 ** 3),
    disk_total: round(disk_total / 1024 ** 3),
    fan_rpm: /^\d+$/.test(rpm) ? Number(rpm) : 0,
    uptime: formatUptime(os.uptime()),
    ip: ipOf(net_iface),
    net_iface,
    net_rx,
    net_tx,
  };
}
