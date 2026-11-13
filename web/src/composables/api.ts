import type { PironmanCommand, StreamEvents, UnitAction } from "../../../shared/types";
import { favoriteKey, usePiStore, type FavoriteSource } from "../stores/pi";
import { askPin } from "./dialog";

let source: EventSource | null = null;

/** The user backed out of a PIN prompt — not an error worth showing. */
export class Cancelled extends Error {}

// Remembered for this tab only, so it's asked once per visit, not per click.
const PIN_KEY = "pi-dash-pin";
const session = {
  get: () => {
    try {
      return sessionStorage.getItem(PIN_KEY);
    } catch {
      return null;
    }
  },
  set: (v: string | null) => {
    try {
      if (v === null) sessionStorage.removeItem(PIN_KEY);
      else sessionStorage.setItem(PIN_KEY, v);
    } catch {
      // private mode: just ask again next time
    }
  },
};

/**
 * fetch() for the JSON API: throws with the server's own error message.
 * When the server wants the action PIN, asks for it and tries again.
 */
export async function api<T = void>(method: string, path: string, body?: unknown): Promise<T> {
  for (;;) {
    const pin = session.get();
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (pin) headers["X-Pin"] = pin;

    const r = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.ok) return (r.status === 204 ? undefined : await r.json()) as T;

    const err = await r.json().catch(() => null);
    if (r.status === 401 && err?.code === "pin") {
      session.set(null);
      // No PIN sent yet: just ask. One sent and refused: say so.
      const typed = await askPin(pin ? err.error : "");
      if (typed === null) throw new Cancelled("Cancelled");
      session.set(typed);
      continue;
    }
    throw new Error(err?.error ?? `HTTP ${r.status}`);
  }
}

const unitPath = (source: FavoriteSource, name: string) =>
  `/units/${source}/${encodeURIComponent(name)}`;

export function useApi() {
  const store = usePiStore();

  /**
   * Live data over Server-Sent Events. The browser reconnects on its own
   * after a drop; the server answers each (re)connection with everything
   * it has, so nothing is missed.
   */
  function connect() {
    source?.close();
    store.setStatus("connecting");
    source = new EventSource("/api/stream");

    source.onopen = () => store.setStatus("connected");
    source.onerror = () => {
      // CONNECTING: the browser is already retrying. CLOSED: it gave up
      // (the server answered with an error), so try again ourselves.
      store.setStatus("connecting");
      if (source?.readyState === EventSource.CLOSED) setTimeout(connect, 5000);
    };

    const on = <K extends keyof StreamEvents>(event: K, fn: (data: StreamEvents[K]) => void) =>
      source!.addEventListener(event, (e) => {
        try {
          fn(JSON.parse((e as MessageEvent).data));
        } catch (err) {
          console.error(`Could not handle ${event} event:`, err);
        }
      });

    on("hello", (d) => (store.server = d));
    on("fast", (d) => store.setFastData(d));
    on("slow", (d) => store.setSlowData(d));
    on("services", (d) => Array.isArray(d) && store.setServices(d));
    on("docker", (d) => Array.isArray(d) && store.setDocker(d));
    on("apps", (d) => Array.isArray(d) && store.setAppStatus(d));
    on("docker_stats", (d) => Array.isArray(d) && store.setDockerStats(d));
    on("adguard", (d) => (store.adguard = d));
  }

  function disconnect() {
    source?.close();
    source = null;
    store.setStatus("disconnected");
  }

  function sendPironman(cmd: PironmanCommand) {
    api("POST", "/pironman", cmd).catch((e) => console.error("Pironman command failed:", e));
  }

  // The star only moves once the server sends the list again with the new
  // value; until then the item is marked pending.
  async function setFavorite(source: FavoriteSource, name: string, value: boolean) {
    store.markFavoritePending(source, name, value);
    try {
      await api("PUT", `${unitPath(source, name)}/favorite`, { value });
    } catch (e) {
      console.error("Favorite failed:", e);
      store.clearFavoritePending(source, name);
    }
  }

  /** Start, stop or restart. Resolves with the error text, or null. */
  async function unitAction(source: FavoriteSource, name: string, action: UnitAction): Promise<string | null> {
    const key = favoriteKey(source, name);
    store.pendingActions[key] = action;
    try {
      await api("POST", `${unitPath(source, name)}/${action}`, {});
      return null;
    } catch (e) {
      return e instanceof Cancelled ? null : (e as Error).message;
    } finally {
      delete store.pendingActions[key];
    }
  }

  return { connect, disconnect, sendPironman, setFavorite, unitAction };
}
