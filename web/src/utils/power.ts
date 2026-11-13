import type { PowerState } from "../../../shared/types";

/** One line for the power supply's state: worst first. */
export function powerSummary(p: PowerState): { label: string; color: string } {
  if (p.undervoltage) return { label: "Under-voltage", color: "#ef4444" };
  if (p.throttled || p.capped) return { label: p.soft_temp ? "Throttled (hot)" : "Throttled", color: "#f97316" };
  if (p.undervoltage_seen) return { label: "Low since boot", color: "#f59e0b" };
  if (p.throttled_seen || p.capped_seen) return { label: "Throttled since boot", color: "#f59e0b" };
  return { label: "OK", color: "#22c55e" };
}
