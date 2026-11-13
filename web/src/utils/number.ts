// SMART values arrive as smartctl prints them — "100%", "3,234", sometimes "?"
// when the drive didn't answer. Strip everything that isn't part of the number
// before comparing or doing arithmetic on them.
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(cleaned) ? cleaned : null;
}
