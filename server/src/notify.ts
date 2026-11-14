// Telegram messages when something on the Pi goes wrong, and again when it's
// fixed. Same rules as the Alerts card (shared/alerts.ts).
import os from "node:os";
import type { DatabaseSync } from "node:sqlite";
import type { Alert } from "../../shared/alerts.ts";
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from "./config.ts";

// A problem has to last this long before it's sent, and be gone this long
// before "fixed" is. A container restarting or a CPU spike stays quiet.
export const SETTLE_MS = 60_000;
// Telegram's limit is 4096 characters; a burst after a reboot stays well under.
const MAX_LINES = 25;

export const telegramEnabled = () => Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);

/** Send one message. Throws with Telegram's own reason when it refuses. */
export async function sendTelegram(html: string): Promise<void> {
  // The token is part of the URL: never log the URL or the request.
  const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });
  if (r.ok) return;
  // Telegram's own words are terse; say which setting to look at.
  if (r.status === 404 || r.status === 401) {
    throw new Error("bot token not recognised — check TELEGRAM_BOT_TOKEN (like 123456789:AAE…, as @BotFather gave it)");
  }
  const body = (await r.json().catch(() => null)) as { description?: string } | null;
  const reason = body?.description ?? `HTTP ${r.status}`;
  throw new Error(/chat not found/i.test(reason)
    ? "chat not found — check TELEGRAM_CHAT_ID, and send your bot a message first"
    : reason);
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const header = () => `<b>Pi Dash</b> · ${escape(os.hostname())}`;

type Sent = Pick<Alert, "key" | "level" | "title" | "detail">;

/** One message for everything that changed in this check. */
export function formatMessage(fresh: Sent[], fixed: Sent[]): string {
  const lines = [
    ...fresh.map((a) => `${a.level === "error" ? "🔴" : "🟠"} <b>${escape(a.title)}</b> — ${escape(a.detail)}`),
    ...fixed.map((a) => `✅ <b>${escape(a.title)}</b> — OK again <i>(was: ${escape(a.detail)})</i>`),
  ];
  const shown = lines.slice(0, MAX_LINES);
  if (lines.length > shown.length) shown.push(`…and ${lines.length - shown.length} more`);
  return [header(), "", ...shown].join("\n");
}

export const testMessage = () => `${header()}\n\n👋 Test message — notifications work.`;

export class Notifier {
  private db: DatabaseSync;
  private send: (html: string) => Promise<void>;
  private settle: number;
  // When each alert was first seen while not yet sent, and when each sent
  // one was first missed. In memory: a restart just restarts the wait.
  private seenSince = new Map<string, number>();
  private goneSince = new Map<string, number>();
  private busy = false;
  private lastError = "";

  constructor(db: DatabaseSync, send = sendTelegram, settle = SETTLE_MS) {
    this.db = db;
    this.send = send;
    this.settle = settle;
  }

  private sent(): Map<string, Sent> {
    const rows = this.db.prepare("SELECT key, level, title, detail FROM notified").all() as Sent[];
    return new Map(rows.map((r) => [r.key, r]));
  }

  /** Compare the current alerts with what was already sent, and send the difference. */
  async check(alerts: Alert[], now = Date.now()): Promise<void> {
    if (this.busy) return;
    const sent = this.sent();
    const current = new Set(alerts.map((a) => a.key));

    for (const key of this.seenSince.keys()) if (!current.has(key)) this.seenSince.delete(key);
    for (const key of this.goneSince.keys()) if (current.has(key)) this.goneSince.delete(key);

    const fresh = alerts.filter((a) => {
      if (sent.has(a.key)) return false;
      if (!this.seenSince.has(a.key)) this.seenSince.set(a.key, now);
      return now - this.seenSince.get(a.key)! >= this.settle;
    });
    const fixed = [...sent.values()].filter((s) => {
      if (current.has(s.key)) return false;
      if (!this.goneSince.has(s.key)) this.goneSince.set(s.key, now);
      return now - this.goneSince.get(s.key)! >= this.settle;
    });
    if (!fresh.length && !fixed.length) return;

    this.busy = true;
    try {
      await this.send(formatMessage(fresh, fixed));
      // Only once Telegram has it: a failed send is tried again next check.
      const add = this.db.prepare(
        "INSERT OR REPLACE INTO notified (key, level, title, detail, sent_at) VALUES (?, ?, ?, ?, ?)",
      );
      const remove = this.db.prepare("DELETE FROM notified WHERE key = ?");
      for (const a of fresh) {
        add.run(a.key, a.level, a.title, a.detail, now);
        this.seenSince.delete(a.key);
      }
      for (const s of fixed) {
        remove.run(s.key);
        this.goneSince.delete(s.key);
      }
      this.lastError = "";
    } catch (e) {
      const msg = (e as Error).message;
      // Once per distinct error, not every check while Telegram is down.
      if (msg !== this.lastError) console.warn(`[notify] Telegram send failed: ${msg}`);
      this.lastError = msg;
    } finally {
      this.busy = false;
    }
  }
}
