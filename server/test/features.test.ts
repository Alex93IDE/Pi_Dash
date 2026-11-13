import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { summarize } from "../src/adguard.ts";
import { parseThrottled, parseVolts } from "../src/metrics/power.ts";
import { pinGuard } from "../src/pin.ts";

test("parseThrottled: now and since-boot bits", () => {
  const f = parseThrottled("throttled=0x50005")!;
  assert.equal(f.undervoltage, true);
  assert.equal(f.throttled, true);
  assert.equal(f.capped, false);
  assert.equal(f.undervoltage_seen, true);
  assert.equal(f.throttled_seen, true);
  assert.equal(f.capped_seen, false);
  assert.equal(parseThrottled("throttled=0x0")!.undervoltage_seen, false);
  assert.equal(parseThrottled(""), null);
});

test("parseVolts", () => {
  assert.equal(parseVolts("EXT5V_V volt(24)=5.13660000V"), 5.14);
  assert.equal(parseVolts("error=1 error_msg=\"Command not registered\""), null);
});

test("adguard summarize", () => {
  const d = summarize(
    {
      time_units: "hours",
      num_dns_queries: 2000,
      num_blocked_filtering: 250,
      avg_processing_time: 0.0123,
      dns_queries: Array(24).fill(1),
      top_blocked_domains: [{ "ads.example": 90 }, { "track.example": 40 }],
    },
    { protection_enabled: true },
  );
  assert.equal(d.blocked_pct, 12.5);
  assert.equal(d.avg_ms, 12.3);
  assert.equal(d.span, "last 24 h");
  assert.deepEqual(d.top_blocked[0], { domain: "ads.example", count: 90 });
});

test("pinGuard: required, wrong, right, and locks after 5 wrong", async () => {
  let clock = 0;
  const app = express();
  app.post("/x", pinGuard("1234", () => clock), (_req, res) => void res.status(204).end());
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const post = (pin?: string) =>
    fetch(`http://127.0.0.1:${port}/x`, { method: "POST", headers: pin === undefined ? {} : { "X-Pin": pin } });
  try {
    assert.equal((await post()).status, 401);
    assert.equal((await post("1234")).status, 204);
    for (let i = 0; i < 5; i++) assert.equal((await post("0000")).status, 401);
    assert.equal((await post("1234")).status, 429); // locked, even with the right PIN
    clock += 5 * 60_000 + 1;
    assert.equal((await post("1234")).status, 204);
  } finally {
    server.close();
  }
});

test("pinGuard with no PIN lets everything through", async () => {
  const app = express();
  app.post("/x", pinGuard(""), (_req, res) => void res.status(204).end());
  const server = app.listen(0);
  try {
    const port = (server.address() as { port: number }).port;
    assert.equal((await fetch(`http://127.0.0.1:${port}/x`, { method: "POST" })).status, 204);
  } finally {
    server.close();
  }
});
