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

// AdGuard blocks an address for 15 min after 5 failed logins (its
// block_auth_min). Asking every 30 s with a wrong password would keep it
// blocked forever, so after a refusal we stay quiet for that long. Fixing
// .env means restarting the service, which clears this anyway.
const AUTH_BACKOFF_MS = 15 * 60_000;
let authFailedUntil = 0;
let authError = "";

class AuthError extends Error {}

// AdGuard's answer while it's locking us out after too many failed logins:
// 429 from the login endpoint, 403 on some versions. The right password is
// refused too until it ends, so it must not read as "wrong password".
const isLockout = (status: number) => status === 429 || status === 403;
const LOCKOUT = "AdGuard is blocking logins after too many failed attempts — wait 15 min";

const base = () => ADGUARD_URL.replace(/\/$/, "");

// Session cookie from /control/login — the same way the web UI signs in.
// Some AdGuard builds refuse basic auth on the API but accept this.
let session = "";

/** Sign in like the browser does. Returns false if AdGuard says no. */
async function login(): Promise<boolean> {
  const r = await fetch(`${base()}/control/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: ADGUARD_USER, password: ADGUARD_PASS }),
    signal: AbortSignal.timeout(5000),
  });
  if (isLockout(r.status)) throw new AuthError(LOCKOUT);
  if (!r.ok) return false;
  // "agh_session=abc123; Path=/; HttpOnly" -> "agh_session=abc123"
  session = (r.headers.getSetCookie?.() ?? [r.headers.get("set-cookie") ?? ""])
    .map((c) => c.split(";")[0])
    .filter((c) => c.startsWith("agh_session="))
    .join("; ");
  return session !== "";
}

async function get<T>(path: string, retried = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (session) headers.Cookie = session;
  else if (ADGUARD_USER) {
    headers.Authorization = `Basic ${Buffer.from(`${ADGUARD_USER}:${ADGUARD_PASS}`).toString("base64")}`;
  }
  const r = await fetch(`${base()}${path}`, { headers, signal: AbortSignal.timeout(5000) });

  if (r.status === 401 && ADGUARD_USER && !retried) {
    // Basic auth refused, or the session expired: sign in and try once more.
    session = "";
    if (await login()) return get<T>(path, true);
    throw new AuthError("AdGuard rejected ADGUARD_USER / ADGUARD_PASS (tried basic auth and login)");
  }
  if (r.status === 401) throw new AuthError("wrong ADGUARD_USER / ADGUARD_PASS");
  if (isLockout(r.status)) throw new AuthError(LOCKOUT);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** null when AdGuard isn't configured, so the card stays hidden. */
export async function collect(): Promise<AdGuardData | null> {
  if (!ADGUARD_URL) return null;
  if (Date.now() < authFailedUntil) {
    const mins = Math.ceil((authFailedUntil - Date.now()) / 60_000);
    return empty(`${authError} (paused, retrying in ${mins} min)`);
  }
  try {
    // One after the other: if the first has to sign in, the second reuses it.
    const status = await get<{ protection_enabled?: boolean }>("/control/status");
    const stats = await get<Stats>("/control/stats");
    return summarize(stats, status);
  } catch (e) {
    if (e instanceof AuthError) {
      authFailedUntil = Date.now() + AUTH_BACKOFF_MS;
      authError = e.message;
    }
    const err = e as Error & { cause?: { code?: string } };
    return empty(err.cause?.code === "ECONNREFUSED" ? "not reachable" : err.message);
  }
}
