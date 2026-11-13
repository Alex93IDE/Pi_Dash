// The Pironman5 case software's local HTTP API, and the commands sent to it.
import { RGB_STYLES, type PironmanCommand } from "../../shared/types.ts";
import { PIRONMAN_API } from "./config.ts";
import { BadRequest } from "./errors.ts";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

async function getConfig(): Promise<Record<string, unknown>> {
  try {
    const r = await fetch(`${PIRONMAN_API}/get-config`, { signal: AbortSignal.timeout(2000) });
    const data = (await r.json()) as { status?: boolean; data?: { system?: Record<string, unknown> } };
    return data?.status ? (data.data?.system ?? {}) : {};
  } catch {
    return {};
  }
}

async function post(endpoint: string, body: unknown): Promise<void> {
  const r = await fetch(`${PIRONMAN_API}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`${endpoint}: HTTP ${r.status}`);
}

/** Case state for the fast payload. Defaults when the API is down. */
export async function collect() {
  const c = await getConfig();
  return {
    rgb_enable: (c.rgb_enable as boolean) ?? false,
    rgb_color: (c.rgb_color as string) ?? "#000000",
    rgb_style: (c.rgb_style as string) ?? "",
    rgb_brightness: (c.rgb_brightness as number) ?? 0,
    rgb_speed: (c.rgb_speed as number) ?? 0,
    oled_enable: (c.oled_enable as boolean) ?? false,
    fan_mode: (c.gpio_fan_mode as number) ?? 1,
  };
}

const intIn = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;

/**
 * Check a command from the browser. Returns the API call to make, or an
 * error message — nothing unchecked reaches the case.
 */
export function validate(cmd: Record<string, unknown>): [string, unknown] | string {
  const a = cmd.action;
  switch (a) {
    case "oled_on":
    case "oled_off":
      return ["set-oled-enable", { enable: a === "oled_on" }];
    case "rgb_on":
    case "rgb_off":
      return ["set-rgb-enable", { enable: a === "rgb_on" }];
    case "rgb_color":
      return typeof cmd.color === "string" && HEX_COLOR.test(cmd.color)
        ? ["set-rgb-color", { color: cmd.color }]
        : `Bad color: ${JSON.stringify(cmd.color)}`;
    case "rgb_style":
      return (RGB_STYLES as readonly unknown[]).includes(cmd.style)
        ? ["set-rgb-style", { style: cmd.style }]
        : `Bad style: ${JSON.stringify(cmd.style)}`;
    case "rgb_brightness":
    case "rgb_speed": {
      const key = a === "rgb_brightness" ? "brightness" : "speed";
      return intIn(cmd.value, 0, 100)
        ? [`set-rgb-${key}`, { [key]: cmd.value }]
        : `Bad ${a} value: ${JSON.stringify(cmd.value)}`;
    }
    case "fan_mode":
      return intIn(cmd.mode, 0, 4)
        ? ["set-fan-mode", { fan_mode: cmd.mode }]
        : `Bad fan mode: ${JSON.stringify(cmd.mode)}`;
    default:
      return `Unknown action: ${JSON.stringify(a)}`;
  }
}

export async function handle(cmd: PironmanCommand | Record<string, unknown>): Promise<void> {
  const checked = validate(cmd as Record<string, unknown>);
  if (typeof checked === "string") throw new BadRequest(checked);
  await post(...checked);
}
