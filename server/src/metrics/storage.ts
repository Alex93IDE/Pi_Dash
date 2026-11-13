// NVMe health from SMART.
import { NVME_DEVICE } from "../config.ts";
import { sudo } from "../shell.ts";

// Payload key -> the line smartctl prints it on.
const FIELDS = {
  nvme_spare: "Available Spare:",
  nvme_used: "Percentage Used:",
  nvme_hours: "Power On Hours:",
  nvme_unsafe: "Unsafe Shutdowns:",
  nvme_errors: "Media and Data Integrity Errors:",
} as const;

/**
 * `smartctl -A` output for an NVMe drive -> payload fields.
 *
 * Values stay as smartctl prints them ("100%", "3,234"); anything missing
 * is "?" and a missing temperature is 0.
 */
export function parseSmart(text: string) {
  const lines = text.split("\n");
  let nvme_temp = 0;
  // "Temperature Sensor 1:" lines are per-sensor; the plain one is the drive.
  const tempLine = lines.find((l) => l.includes("Temperature:") && !l.includes("Sensor"));
  if (tempLine) {
    const t = Number(tempLine.trim().split(/\s+/)[1]);
    if (Number.isFinite(t)) nvme_temp = t;
  }

  const d: Record<keyof typeof FIELDS, string> = { ...FIELDS };
  for (const [key, label] of Object.entries(FIELDS) as [keyof typeof FIELDS, string][]) {
    const line = lines.find((l) => l.includes(label));
    d[key] = line ? line.trim().split(/\s+/).at(-1)! : "?";
  }
  return { nvme_temp, ...d };
}

export async function collect() {
  return parseSmart(NVME_DEVICE ? await sudo("smartctl", ["-A", NVME_DEVICE]) : "");
}
