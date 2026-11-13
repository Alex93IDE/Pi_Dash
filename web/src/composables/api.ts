import type { PironmanCommand, StreamEvents, UnitAction } from "../../../shared/types";
import { favoriteKey, usePiStore, type FavoriteSource } from "../stores/pi";

let source: EventSource | null = null;

/** fetch() for the JSON API: throws with the server's own error message. */
export async function api<T = void>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => null);
    throw new Error(err?.error ?? `HTTP ${r.status}`);
  }
  return (r.status === 204 ? undefined : await r.json()) as T;
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
      return (e as Error).message;
    } finally {
      delete store.pendingActions[key];
    }
  }

  return { connect, disconnect, sendPironman, setFavorite, unitAction };
}
