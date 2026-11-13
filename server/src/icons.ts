// Each app's own icon, fetched by the server rather than the browser: the
// server reaches localhost ports the firewall closes to the LAN, and isn't
// stopped by mixed content when the dashboard is served over HTTPS.
import type { DatabaseSync } from "node:sqlite";

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 4000;
// After a failed lookup, don't knock on the app again for a while.
const RETRY_FAILED_MS = 60 * 60 * 1000;

type Icon = { type: string; data: Uint8Array };

/** {host} means "this Pi", which from the server is localhost. */
export const serverSideUrl = (url: string) => url.replaceAll("{host}", "127.0.0.1");

/**
 * Icon candidates from a page's <link> tags, best first: SVG, then the
 * largest declared size, apple-touch-icon among them; /favicon.ico last.
 */
export function iconCandidates(html: string, base: string): string[] {
  const found: { href: string; score: number }[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attr = (name: string) =>
      new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag)?.slice(1).find((v) => v !== undefined);
    const rel = attr("rel")?.toLowerCase() ?? "";
    const href = attr("href");
    if (!href || !/(^|\s)(icon|apple-touch-icon(-precomposed)?)(\s|$)/.test(rel)) continue;
    if (rel.includes("mask-icon")) continue; // monochrome Safari pinned-tab icon
    let url: string;
    try {
      url = new URL(href, base).href;
    } catch {
      continue;
    }
    const isSvg = /\.svg(\?|$)/i.test(href) || /svg/i.test(attr("type") ?? "");
    const size = Math.max(0, ...(attr("sizes") ?? "").split(/\s+/).map((s) => Number(s.split("x")[0]) || 0));
    found.push({ href: url, score: isSvg ? 10_000 : size || (rel.includes("apple") ? 180 : 32) });
  }
  const urls = found.sort((a, b) => b.score - a.score).map((f) => f.href);
  try {
    urls.push(new URL("/favicon.ico", base).href);
  } catch {
    // base wasn't a URL
  }
  return [...new Set(urls)];
}

/** What the bytes actually are — servers often send .ico as text/plain. */
export function sniffType(data: Uint8Array, header: string | null): string | null {
  const starts = (...bytes: number[]) => bytes.every((b, i) => data[i] === b);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(0x00, 0x00, 0x01, 0x00)) return "image/x-icon";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46)) return "image/gif";
  if (starts(0x52, 0x49, 0x46, 0x46) && data[8] === 0x57) return "image/webp";
  const head = new TextDecoder().decode(data.subarray(0, 256)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return header?.startsWith("image/") && !header.includes("svg") ? header.split(";")[0] : null;
}

async function get(url: string): Promise<Response | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "follow" });
    return r.ok ? r : null;
  } catch {
    return null;
  }
}

async function readSmall(r: Response): Promise<Uint8Array | null> {
  if (Number(r.headers.get("content-length")) > MAX_BYTES) return null;
  const data = new Uint8Array(await r.arrayBuffer());
  return data.byteLength > 0 && data.byteLength <= MAX_BYTES ? data : null;
}

/** Find and download an app's icon, or null if it has none we can use. */
export async function fetchIcon(appUrl: string): Promise<Icon | null> {
  const base = serverSideUrl(appUrl);
  const page = await get(base);
  const html = page && (page.headers.get("content-type") ?? "").includes("html")
    ? new TextDecoder().decode((await readSmall(page)) ?? new Uint8Array())
    : "";
  // Redirects (to /login, say) change the base relative links resolve against.
  for (const url of iconCandidates(html, page?.url || base)) {
    const r = await get(url);
    const data = r && (await readSmall(r));
    const type = data && sniffType(data, r.headers.get("content-type"));
    if (data && type) return { type, data };
  }
  return null;
}

export class Icons {
  private db: DatabaseSync;
  private inFlight = new Map<number, Promise<Icon | null>>();

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  /** The cached icon, fetching it first if it's missing or a failure has expired. */
  async get(appId: number, appUrl: string): Promise<Icon | null> {
    const row = this.db
      .prepare("SELECT url, type, data, fetched_at FROM app_icons WHERE app_id = ?")
      .get(appId) as { url: string; type: string | null; data: Uint8Array | null; fetched_at: number } | undefined;
    if (row && row.url === appUrl && (row.data || Date.now() - row.fetched_at < RETRY_FAILED_MS)) {
      return row.data && row.type ? { type: row.type, data: row.data } : null;
    }

    // Several tiles loading at once share one lookup.
    let pending = this.inFlight.get(appId);
    if (!pending) {
      pending = fetchIcon(appUrl).finally(() => this.inFlight.delete(appId));
      this.inFlight.set(appId, pending);
    }
    const icon = await pending;
    this.db
      .prepare(
        `INSERT OR REPLACE INTO app_icons (app_id, url, type, data, fetched_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(appId, appUrl, icon?.type ?? null, icon?.data ?? null, Date.now());
    return icon;
  }

  forget(appId: number): void {
    this.db.prepare("DELETE FROM app_icons WHERE app_id = ?").run(appId);
  }
}
