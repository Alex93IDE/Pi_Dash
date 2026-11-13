// AdGuard Home's numbers, from its own API.
import type { AdGuardData } from "../../shared/types.ts";
import { ADGUARD_PASS, ADGUARD_URL, ADGUARD_USER } from "./config.ts";

type Stats = {
  time_units?: string;
  num_dns_queries?: number;
  num_blocked_filtering?: number;
  avg_processing_time?: number; // seconds
  dns_queries?: number[];
  blocked_filtering?: number[];
  top_blocked_domains?: Record<string, number>[];
};

const empty = (error: string): AdGuardData => ({
  ok: false,
  error,
  protection: false,
  queries: 0,
  blocked: 0,
  blocked_pct: 0,
  avg_ms: 0,
  span: "",
  queries_series: [],
  blocked_series: [],
  top_blocked: [],
});

/** AdGuard's /control/stats and /control/status -> what the card shows. */
export function summarize(stats: Stats, status: { protection_enabled?: boolean }): AdGuardData {
  const queries = stats.num_dns_queries ?? 0;
  const blocked = stats.num_blocked_filtering ?? 0;
  const series = stats.dns_queries ?? [];
  const unit = stats.time_units === "days" ? "d" : "h";
  return {
    ok: true,
    error: null,
    protection: status.protection_enabled ?? false,
    queries,
    blocked,
    blocked_pct: queries ? Number(((100 * blocked) / queries).toFixed(1)) : 0,
    avg_ms: Number(((stats.avg_processing_time ?? 0) * 1000).toFixed(1)),
    span: series.length ? `last ${series.length} ${unit}` : "",
    queries_series: series,
    blocked_series: stats.blocked_filtering ?? [],
    top_blocked: (stats.top_blocked_domains ?? [])
      .slice(0, 5)
      .map((entry) => Object.entries(entry)[0])
      .filter(Boolean)
      .map(([domain, count]) => ({ domain, count })),
  };
}

async function get<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (ADGUARD_USER) {
    headers.Authorization = `Basic ${Buffer.from(`${ADGUARD_USER}:${ADGUARD_PASS}`).toString("base64")}`;
  }
  const r = await fetch(`${ADGUARD_URL.replace(/\/$/, "")}${path}`, {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  if (r.status === 401 || r.status === 403) throw new Error("wrong ADGUARD_USER / ADGUARD_PASS");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** null when AdGuard isn't configured, so the card stays hidden. */
export async function collect(): Promise<AdGuardData | null> {
  if (!ADGUARD_URL) return null;
  try {
    const [stats, status] = await Promise.all([
      get<Stats>("/control/stats"),
      get<{ protection_enabled?: boolean }>("/control/status"),
    ]);
    return summarize(stats, status);
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    return empty(err.cause?.code === "ECONNREFUSED" ? "not reachable" : err.message);
  }
}
