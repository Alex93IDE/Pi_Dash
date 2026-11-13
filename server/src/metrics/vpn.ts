// WireGuard peers.
import { WG_INTERFACE } from "../config.ts";
import { sudo } from "../shell.ts";

/**
 * `wg show <if> latest-handshakes` output -> [active, total] peers.
 *
 * A peer counts as active if it shook hands within the last `window`
 * seconds — WireGuard re-handshakes every two minutes while traffic flows.
 */
export function parseWgHandshakes(text: string, now: number, window = 60): [number, number] {
  let active = 0;
  let total = 0;
  for (const line of text.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 2 || !/^\d+$/.test(parts[1])) continue;
    total++;
    const ts = Number(parts[1]);
    if (ts !== 0 && now - ts < window) active++;
  }
  return [active, total];
}

export async function collect() {
  const out = WG_INTERFACE ? await sudo("wg", ["show", WG_INTERFACE, "latest-handshakes"]) : "";
  const [wg_active, wg_total] = parseWgHandshakes(out, Math.floor(Date.now() / 1000));
  return { wg_active, wg_total };
}
