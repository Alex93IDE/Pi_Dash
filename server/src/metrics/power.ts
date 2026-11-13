// Power supply health from the Pi's firmware: under-voltage and throttling.
// vcgencmd needs no root, only membership in the `video` group.
import type { PowerState } from "../../../shared/types.ts";
import { run } from "../shell.ts";

// Bits of `vcgencmd get_throttled`: the low ones are "right now", the same
// ones shifted by 16 are "has happened since boot" and stay set until reboot.
const BITS = { undervoltage: 0, capped: 1, throttled: 2, soft_temp: 3 } as const;

/** "throttled=0x50005" -> flags, or null if there's no answer (not a Pi). */
export function parseThrottled(text: string): Omit<PowerState, "volts"> | null {
  const m = /throttled=(0x[0-9a-f]+)/i.exec(text);
  if (!m) return null;
  const v = Number.parseInt(m[1], 16);
  const now = (bit: number) => (v & (1 << bit)) !== 0;
  const seen = (bit: number) => (v & (1 << (bit + 16))) !== 0;
  return {
    undervoltage: now(BITS.undervoltage),
    capped: now(BITS.capped),
    throttled: now(BITS.throttled),
    soft_temp: now(BITS.soft_temp),
    undervoltage_seen: seen(BITS.undervoltage),
    capped_seen: seen(BITS.capped),
    throttled_seen: seen(BITS.throttled),
    soft_temp_seen: seen(BITS.soft_temp),
  };
}

/** "EXT5V_V volt(24)=5.13660000V" -> 5.14 — the Pi 5's 5 V input. */
export function parseVolts(text: string): number | null {
  const m = /=([\d.]+)V/.exec(text);
  return m ? Number(Number(m[1]).toFixed(2)) : null;
}

export async function collect(): Promise<{ power: PowerState | null }> {
  const [throttled, volts] = await Promise.all([
    run("vcgencmd", ["get_throttled"]),
    // Pi 5 only; older models just don't answer.
    run("vcgencmd", ["pmic_read_adc", "EXT5V_V"]),
  ]);
  const flags = parseThrottled(throttled);
  return { power: flags && { ...flags, volts: parseVolts(volts) } };
}
