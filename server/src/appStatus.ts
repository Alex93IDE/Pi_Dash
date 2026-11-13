// Is each app answering? Checked from the Pi itself, like the icons, so the
// answer doesn't depend on the firewall between the Pi and the browser.
import http from "node:http";
import https from "node:https";
import type { App, AppStatus } from "../../shared/types.ts";
import { serverSideUrl } from "./icons.ts";

const TIMEOUT_MS = 5000;

type Result = Omit<AppStatus, "id" | "name">;

/**
 * Any HTTP answer below 500 counts as up — a login page (401, 403) or a
 * redirect still means the app is running. 5xx, a refused connection or a
 * timeout is down. Certificates aren't checked: a self-signed one is normal
 * on a home server, and nothing is sent but the request itself.
 */
export function checkUrl(url: string, timeout = TIMEOUT_MS): Promise<Result> {
  const started = performance.now();
  return new Promise((resolve) => {
    let target: URL;
    try {
      target = new URL(serverSideUrl(url));
    } catch {
      return resolve({ up: false, code: null, ms: null, error: "invalid URL" });
    }
    const lib = target.protocol === "https:" ? https : http;
    const req = lib.request(
      target,
      { method: "GET", timeout, rejectUnauthorized: false, headers: { "User-Agent": "pi-dash" } },
      (res) => {
        const code = res.statusCode ?? 0;
        const ms = Math.round(performance.now() - started);
        // Headers are all we need; don't download the page.
        res.destroy();
        resolve(code < 500 ? { up: true, code, ms, error: null } : { up: false, code, ms, error: `HTTP ${code}` });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e: NodeJS.ErrnoException) => {
      const reason: Record<string, string> = {
        ECONNREFUSED: "connection refused",
        ENOTFOUND: "host not found",
        EHOSTUNREACH: "host unreachable",
        ECONNRESET: "connection reset",
      };
      resolve({ up: false, code: null, ms: null, error: reason[e.code ?? ""] ?? e.message });
    });
    req.end();
  });
}

export async function checkAll(apps: App[]): Promise<AppStatus[]> {
  return Promise.all(apps.map(async (a) => ({ id: a.id, name: a.name, ...(await checkUrl(a.url)) })));
}
