import assert from "node:assert/strict";
import { test } from "node:test";
import { computeAlerts, type Alert, type AlertInput } from "../../shared/alerts.ts";
import { openDb } from "../src/db.ts";
import { formatMessage, Notifier } from "../src/notify.ts";

const healthy: AlertInput = {
  fast: { cpu_temp: 50, ram_pct: 40, disk_pct: 20 },
  slow: { nvme_temp: 40, nvme_spare: "100%", nvme_used: "1%", nvme_errors: "0", ufw_status: "active", power: null },
  services: [],
  docker: [],
  apps: [],
  adguard: null,
};

test("computeAlerts: nothing on a healthy Pi, stable keys, errors first", () => {
  assert.deepEqual(computeAlerts(healthy), []);
  const alerts = computeAlerts({
    ...healthy,
    fast: { ...healthy.fast, cpu_temp: 83 },
    docker: [{ name: "web", image: "nginx", state: "exited", status: "Exited (1)", favorite: false }],
    services: [{ name: "nginx.service", active: "failed", sub: "failed", enabled: "enabled", description: "", favorite: false }],
  });
  assert.deepEqual(alerts.map((a) => [a.key, a.level]), [
    ["systemd:nginx.service", "error"],
    ["docker:web", "warn"],
    ["cpu:temp", "warn"],
  ]);
});

const alert = (key: string, detail = "down"): Alert => ({ key, level: "error", title: key, detail });

test("Notifier: waits for a problem to last, sends once, then sends the fix", async () => {
  const sent: string[] = [];
  const n = new Notifier(openDb(":memory:"), async (m) => void sent.push(m), 60_000);

  await n.check([alert("a")], 0);
  assert.equal(sent.length, 0, "too soon");
  await n.check([alert("a")], 30_000);
  assert.equal(sent.length, 0, "still too soon");
  await n.check([alert("a", "down again")], 60_000);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /🔴 <b>a<\/b> — down again/);

  await n.check([alert("a")], 120_000);
  assert.equal(sent.length, 1, "no repeat while it lasts");

  await n.check([], 130_000);
  await n.check([alert("a")], 140_000); // back before the fix settled: nothing
  await n.check([], 150_000);
  assert.equal(sent.length, 1);
  await n.check([], 210_000);
  assert.equal(sent.length, 2);
  assert.match(sent[1], /✅ <b>a<\/b> — OK again/);
});

test("Notifier: a blip never sends; a failed send is retried; a restart doesn't repeat", async () => {
  const db = openDb(":memory:");
  const sent: string[] = [];
  let fail = true;
  const send = async (m: string) => {
    if (fail) throw new Error("Bad Request: chat not found");
    sent.push(m);
  };
  const n = new Notifier(db, send, 60_000);

  await n.check([alert("blip")], 0);
  await n.check([], 30_000);
  await n.check([], 90_000);

  await n.check([alert("b")], 100_000);
  const warn = console.warn;
  console.warn = () => {};
  try {
    await n.check([alert("b")], 160_000); // fails
  } finally {
    console.warn = warn;
  }
  fail = false;
  await n.check([alert("b")], 175_000);
  assert.equal(sent.length, 1);
  assert.doesNotMatch(sent[0], /blip/);

  // Same database after a restart: b was already sent.
  const again = new Notifier(db, send, 60_000);
  await again.check([alert("b")], 300_000);
  await again.check([alert("b")], 400_000);
  assert.equal(sent.length, 1);
});

test("formatMessage escapes HTML and caps long lists", () => {
  const m = formatMessage([{ key: "x", level: "warn", title: "<x>", detail: "a & b" }], []);
  assert.match(m, /🟠 <b>&lt;x&gt;<\/b> — a &amp; b/);
  const many = Array.from({ length: 30 }, (_, i) => alert(`k${i}`));
  assert.match(formatMessage(many, []), /…and 5 more$/);
});
