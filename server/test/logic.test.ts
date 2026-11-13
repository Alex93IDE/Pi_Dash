import assert from "node:assert/strict";
import { test } from "node:test";
import { Apps, validateApp } from "../src/apps.ts";
import { openDb } from "../src/db.ts";
import { BadRequest } from "../src/errors.ts";
import { History } from "../src/history.ts";
import { validate } from "../src/pironman.ts";
import { checkAction, Favorites } from "../src/units.ts";

test("pironman.validate accepts good commands", () => {
  assert.deepEqual(validate({ action: "oled_on" }), ["set-oled-enable", { enable: true }]);
  assert.deepEqual(validate({ action: "rgb_color", color: "#00ff00" }), ["set-rgb-color", { color: "#00ff00" }]);
  assert.deepEqual(validate({ action: "rgb_speed", value: 40 }), ["set-rgb-speed", { speed: 40 }]);
  assert.deepEqual(validate({ action: "fan_mode", mode: 4 }), ["set-fan-mode", { fan_mode: 4 }]);
});

test("pironman.validate rejects bad ones", () => {
  for (const cmd of [
    { action: "rgb_color", color: "red" },
    { action: "rgb_style", style: "$(reboot)" },
    { action: "rgb_brightness", value: 101 },
    { action: "rgb_brightness", value: 1.5 },
    { action: "rgb_brightness", value: true },
    { action: "fan_mode", mode: 5 },
    { action: "reboot" },
    {},
  ]) {
    assert.equal(typeof validate(cmd), "string", JSON.stringify(cmd));
  }
});

test("checkAction only allows known names, known actions, and never stops protected units", () => {
  const known = [{ name: "nginx.service" }, { name: "ssh.service" }];
  assert.equal(checkAction("systemd", "nginx.service", "restart", known), "restart");
  assert.throws(() => checkAction("systemd", "--force", "stop", known), BadRequest);
  assert.throws(() => checkAction("systemd", "nginx.service", "kill", known), BadRequest);
  assert.throws(() => checkAction("systemd", "ssh.service", "stop", known), BadRequest);
  assert.equal(checkAction("systemd", "ssh.service", "restart", known), "restart");
});

test("validateApp", () => {
  assert.deepEqual(validateApp({ name: " Keeper ", url: "http://{host}:8080", description: "" }), {
    name: "Keeper",
    url: "http://{host}:8080",
    description: "",
  });
  assert.throws(() => validateApp({ name: "x", url: "javascript:alert(1)" }), BadRequest);
  assert.throws(() => validateApp({ name: "", url: "http://a" }), BadRequest);
  assert.throws(() => validateApp({ name: "x", url: "not a url" }), BadRequest);
});

test("Apps CRUD", () => {
  const apps = new Apps(openDb(":memory:"));
  const a = apps.create({ name: "WGDashboard", url: "http://{host}:10086", description: "" });
  assert.equal(apps.list().length, 1);
  assert.equal(apps.update(a.id, { ...a, name: "WG" }), true);
  assert.equal(apps.list()[0].name, "WG");
  assert.equal(apps.remove(a.id), true);
  assert.equal(apps.remove(a.id), false);
});

test("Favorites", () => {
  const favs = new Favorites(openDb(":memory:"));
  favs.set("docker", "web", true);
  favs.set("docker", "web", true);
  assert.deepEqual([...favs.names("docker")], ["web"]);
  assert.equal(favs.names("systemd").size, 0);
  favs.set("docker", "web", false);
  assert.equal(favs.names("docker").size, 0);
});

test("History averages each minute and buckets on read", () => {
  const h = new History(openDb(":memory:"), 30);
  const t0 = Date.UTC(2026, 0, 1, 12, 0, 0);
  const sample = (cpu: number) => ({ cpu_pct: cpu, cpu_temp: 50, ram_pct: 40, disk_pct: 10, net_rx: 100, net_tx: 10 });
  h.add(sample(10), t0);
  h.add(sample(30), t0 + 1000);
  h.add(sample(50), t0 + 60_000); // next minute: writes the first
  h.flush(t0 + 61_000);

  const pts = h.query("1h", t0 + 120_000);
  assert.equal(pts.length, 2);
  assert.equal(pts[0].cpu, 20);
  assert.equal(pts[0].cpu_max, 30);
  assert.equal(pts[1].cpu, 50);

  // 24h buckets are 5 minutes: both minutes fall into one.
  const day = h.query("24h", t0 + 120_000);
  assert.equal(day.length, 1);
  assert.equal(day[0].cpu, 35);
  assert.equal(day[0].cpu_max, 50);
});
