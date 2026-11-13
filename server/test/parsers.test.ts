import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCrowdsec, parseF2b, parseUfw } from "../src/metrics/security.ts";
import { parseSmart } from "../src/metrics/storage.ts";
import { cpuUsage, defaultRouteInterface, formatUptime, parseNetDev } from "../src/metrics/system.ts";
import { parseWgHandshakes } from "../src/metrics/vpn.ts";
import { parseDockerPs, toServices } from "../src/units.ts";

test("formatUptime", () => {
  assert.equal(formatUptime(0), "0d 0h 0m");
  assert.equal(formatUptime(90061), "1d 1h 1m");
});

test("defaultRouteInterface picks the 00000000 destination", () => {
  const table = [
    "Iface\tDestination\tGateway\tFlags",
    "wg0\t0000080A\t00000000\t0001",
    "eth0\t00000000\t0101A8C0\t0003",
  ].join("\n");
  assert.equal(defaultRouteInterface(table), "eth0");
  assert.equal(defaultRouteInterface("Iface\tDestination\n"), "");
});

test("parseNetDev reads rx and tx bytes", () => {
  const text = [
    "Inter-|   Receive                                                |  Transmit",
    " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets",
    "  eth0: 1000 10 0 0 0 0 0 0 2000 20 0 0 0 0 0 0",
  ].join("\n");
  assert.deepEqual(parseNetDev(text).get("eth0"), { rx: 1000, tx: 2000 });
});

test("cpuUsage from two samples", () => {
  const prev = [{ idle: 100, total: 200 }, { idle: 100, total: 200 }];
  const now = [{ idle: 150, total: 300 }, { idle: 200, total: 300 }];
  assert.deepEqual(cpuUsage(prev, now), [25, [50, 0]]);
  assert.deepEqual(cpuUsage(null, now), [0, [0, 0]]);
});

test("parseWgHandshakes counts recent peers as active", () => {
  const text = "peerA=\t1000\npeerB=\t0\npeerC=\t900\ngarbage";
  assert.deepEqual(parseWgHandshakes(text, 1030), [1, 3]);
});

test("parseSmart keeps smartctl's values and skips per-sensor temps", () => {
  const text = [
    "Temperature Sensor 1:               50 Celsius",
    "Temperature:                        42 Celsius",
    "Available Spare:                    100%",
    "Percentage Used:                    1%",
    "Power On Hours:                     3,234",
    "Unsafe Shutdowns:                   12",
    "Media and Data Integrity Errors:    0",
  ].join("\n");
  assert.deepEqual(parseSmart(text), {
    nvme_temp: 42,
    nvme_spare: "100%",
    nvme_used: "1%",
    nvme_hours: "3,234",
    nvme_unsafe: "12",
    nvme_errors: "0",
  });
  assert.equal(parseSmart("").nvme_spare, "?");
});

test("parseUfw: status and rules", () => {
  const text = [
    "Status: active",
    "",
    "     To                         Action      From",
    "     --                         ------      ----",
    "[ 1] 22/tcp                     ALLOW IN    192.168.1.0/24",
    "[ 2] 51820/udp                  ALLOW IN    Anywhere",
  ].join("\n");
  const [status, rules] = parseUfw(text);
  assert.equal(status, "active");
  assert.deepEqual(rules[0], { num: 1, to: "22/tcp", action: "ALLOW IN", from: "192.168.1.0/24" });
  assert.equal(rules.length, 2);
  assert.equal(parseUfw("Status: inactive")[0], "inactive");
  assert.equal(parseUfw("")[0], "inactive");
});

test("parseF2b and parseCrowdsec", () => {
  assert.equal(parseF2b("|- Currently failed: 1\n|  `- Currently banned: 3"), 3);
  assert.equal(parseF2b(""), 0);
  const cs = JSON.stringify([{ decisions: [{ type: "ban" }, { type: "captcha" }] }, { decisions: [{ type: "ban" }] }]);
  assert.equal(parseCrowdsec(cs), 2);
  assert.equal(parseCrowdsec("null"), 0);
  assert.equal(parseCrowdsec(""), 0);
});

test("parseDockerPs marks favorites and skips bad lines", () => {
  const text = [
    JSON.stringify({ Names: "web", Image: "nginx", State: "running", Status: "Up 2 hours" }),
    "not json",
  ].join("\n");
  assert.deepEqual(parseDockerPs(text, new Set(["web"])), [
    { name: "web", image: "nginx", state: "running", status: "Up 2 hours", favorite: true },
  ]);
});

test("toServices: template unit files and not-found units", () => {
  const units = [
    { unit: "ssh.service", load: "loaded", active: "active", sub: "running", description: "SSH" },
    { unit: "getty@tty1.service", load: "loaded", active: "active", sub: "running", description: "Getty" },
    { unit: "ghost.service", load: "not-found", active: "inactive", sub: "dead" },
  ];
  const files = [
    { unit_file: "ssh.service", state: "enabled" },
    { unit_file: "getty@.service", state: "enabled" },
  ];
  const out = toServices(units, files, new Set(["ssh.service"]));
  assert.equal(out.length, 2);
  assert.equal(out[0].favorite, true);
  assert.equal(out[1].enabled, "enabled");
});
