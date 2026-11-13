// Long-term metrics: one averaged row per minute, read back in buckets sized
// so every range comes out at a few hundred points.
import type { DatabaseSync } from "node:sqlite";
import type { FastData, HistoryPoint, HistoryRange } from "../../shared/types.ts";

const MINUTE = 60_000;

// Range -> [how far back, bucket size]. ~60 to 360 points each.
export const RANGES: Record<HistoryRange, [number, number]> = {
  "1h": [60 * MINUTE, MINUTE],
  "24h": [24 * 60 * MINUTE, 5 * MINUTE],
  "7d": [7 * 24 * 60 * MINUTE, 30 * MINUTE],
  "30d": [30 * 24 * 60 * MINUTE, 120 * MINUTE],
};

type Sample = Pick<FastData, "cpu_pct" | "cpu_temp" | "ram_pct" | "disk_pct" | "net_rx" | "net_tx">;

/** Averages a minute's worth of samples into one row. */
export function summarize(minute: number, samples: Sample[]) {
  const avg = (f: (s: Sample) => number) => samples.reduce((n, s) => n + f(s), 0) / samples.length;
  const max = (f: (s: Sample) => number) => Math.max(...samples.map(f));
  return {
    ts: minute,
    cpu: avg((s) => s.cpu_pct),
    cpu_max: max((s) => s.cpu_pct),
    temp: avg((s) => s.cpu_temp),
    temp_max: max((s) => s.cpu_temp),
    ram: avg((s) => s.ram_pct),
    disk: avg((s) => s.disk_pct),
    rx: avg((s) => s.net_rx),
    tx: avg((s) => s.net_tx),
  };
}

export class History {
  private db: DatabaseSync;
  private keepMs: number;
  private minute = 0;
  private samples: Sample[] = [];
  private lastPrune = 0;

  constructor(db: DatabaseSync, keepDays: number) {
    this.db = db;
    this.keepMs = keepDays * 24 * 60 * MINUTE;
  }

  /** Feed every fast sample; a row is written when its minute is over. */
  add(sample: Sample, now = Date.now()): void {
    const minute = now - (now % MINUTE);
    if (minute !== this.minute) {
      this.flush();
      this.minute = minute;
    }
    this.samples.push(sample);
  }

  /** Write the minute in progress — on shutdown, so it isn't lost. */
  flush(now = Date.now()): void {
    if (this.samples.length) {
      const row = summarize(this.minute, this.samples);
      this.db
        .prepare(
          `INSERT OR REPLACE INTO metrics (ts, cpu, cpu_max, temp, temp_max, ram, disk, rx, tx)
           VALUES (:ts, :cpu, :cpu_max, :temp, :temp_max, :ram, :disk, :rx, :tx)`,
        )
        .run(row);
      this.samples = [];
    }
    if (now - this.lastPrune > 60 * MINUTE) {
      this.db.prepare("DELETE FROM metrics WHERE ts < ?").run(now - this.keepMs);
      this.lastPrune = now;
    }
  }

  query(range: HistoryRange, now = Date.now()): HistoryPoint[] {
    const [span, bucket] = RANGES[range];
    const rows = this.db
      .prepare(
        // node:sqlite binds JS numbers as REAL; the CAST keeps the division whole.
        `SELECT (ts / CAST(:bucket AS INTEGER)) * CAST(:bucket AS INTEGER) AS ts,
                AVG(cpu) AS cpu, MAX(cpu_max) AS cpu_max,
                AVG(temp) AS temp, MAX(temp_max) AS temp_max,
                AVG(ram) AS ram, AVG(disk) AS disk,
                AVG(rx) AS rx, AVG(tx) AS tx
         FROM metrics WHERE ts >= :since
         GROUP BY 1 ORDER BY 1`,
      )
      .all({ bucket, since: now - span }) as HistoryPoint[];
    const r = (n: number, d = 1) => Number(n.toFixed(d));
    return rows.map((p) => ({
      ts: p.ts,
      cpu: r(p.cpu),
      cpu_max: r(p.cpu_max),
      temp: r(p.temp),
      temp_max: r(p.temp_max),
      ram: r(p.ram),
      disk: r(p.disk),
      rx: Math.round(p.rx),
      tx: Math.round(p.tx),
    }));
  }
}
