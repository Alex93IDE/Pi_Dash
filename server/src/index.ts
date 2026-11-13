// Pi Dash: one process that reads the Pi, keeps its history, and serves the
// dashboard and its API.
import { existsSync } from "node:fs";
import path from "node:path";
import express from "express";
import type { FastData } from "../../shared/types.ts";
import { Apps } from "./apps.ts";
import { checkAll } from "./appStatus.ts";
import * as config from "./config.ts";
import { openDb } from "./db.ts";
import { History } from "./history.ts";
import { Icons } from "./icons.ts";
import { Hub, Publisher } from "./hub.ts";
import * as adguard from "./adguard.ts";
import * as power from "./metrics/power.ts";
import * as security from "./metrics/security.ts";
import * as storage from "./metrics/storage.ts";
import * as system from "./metrics/system.ts";
import * as vpn from "./metrics/vpn.ts";
import * as pironman from "./pironman.ts";
import { apiRouter } from "./routes.ts";
import { containerStats, Favorites, listContainers, listServices } from "./units.ts";

const db = openDb();
const favorites = new Favorites(db);
const apps = new Apps(db);
const icons = new Icons(db);
const history = new History(db, config.HISTORY_DAYS);

const hub = new Hub(() => ({
  version: config.VERSION,
  unitControl: config.UNIT_CONTROL,
  protectedUnits: config.PROTECTED_UNITS,
  pinRequired: Boolean(config.ACTION_PIN),
}));

const publishers = {
  fast: new Publisher(hub, "fast", config.INTERVAL_FAST, async () => {
    const [sys, wg, case_] = await Promise.all([system.collect(), vpn.collect(), pironman.collect()]);
    return { ...sys, ...wg, ...case_, timestamp: new Date().toISOString() } satisfies FastData;
  }),
  slow: new Publisher(hub, "slow", config.INTERVAL_SLOW, async () => {
    const [nvme, sec, pwr] = await Promise.all([storage.collect(), security.collect(), power.collect()]);
    return { ...nvme, ...sec, ...pwr };
  }),
  systemd: new Publisher(hub, "services", config.INTERVAL_SLOW, () => listServices(favorites.names("systemd"))),
  docker: new Publisher(hub, "docker", config.INTERVAL_SLOW, () => listContainers(favorites.names("docker"))),
  dockerStats: new Publisher(hub, "docker_stats", config.INTERVAL_DOCKER_STATS, containerStats, {
    onlyWatched: true,
  }),
  apps: new Publisher(hub, "apps", config.INTERVAL_SLOW, () => checkAll(apps.list())),
  adguard: new Publisher(hub, "adguard", config.INTERVAL_SLOW, adguard.collect),
};

hub.on("fast", (d) => history.add(d));
// Stats aren't collected while nobody watches, so what's cached may be old.
hub.onConnect(() => publishers.dockerStats.trigger());

// ── HTTP ─────────────────────────────────────────────────
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use("/api", apiRouter({ hub, favorites, apps, icons, history, publishers }));

if (!existsSync(path.join(config.WEB_ROOT, "index.html"))) {
  console.warn(`[http] ${config.WEB_ROOT}/index.html not found — run "npm run build"`);
}
app.use(
  express.static(config.WEB_ROOT, {
    index: false,
    // Vite hashes everything under assets/; everything else must never be stale.
    setHeaders(res, file) {
      res.setHeader(
        "Cache-Control",
        file.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
      );
    },
  }),
);
// History-mode routing: a reload on /services has to get the app back.
// Anything that looks like a file (has an extension) still 404s, so a
// missing asset doesn't come back as HTML.
app.use((req, res, next) => {
  if (req.method !== "GET" || path.extname(req.path)) return next();
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(config.WEB_ROOT, "index.html"), (err) => err && next());
});

const server = app.listen(config.PORT, config.HOST, () => {
  console.log(`Pi Dash v${config.VERSION} on http://${config.HOST}:${config.PORT}`);
});

for (const p of Object.values(publishers)) p.start();
const keepAlive = setInterval(() => hub.keepAlive(), 25_000);

// systemctl stop sends SIGTERM; Ctrl+C sends SIGINT.
function shutdown() {
  console.log("Shutting down");
  for (const p of Object.values(publishers)) p.stop();
  clearInterval(keepAlive);
  history.flush();
  hub.closeAll();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Don't hang on a stuck connection.
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
