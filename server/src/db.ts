// Everything kept on disk: favorites, apps and the metrics history, in one
// SQLite file under data/. node:sqlite ships with Node, so there is no native
// module to compile on the Pi.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR } from "./config.ts";

export function openDb(file = path.join(DATA_DIR, "pi-dash.db")): DatabaseSync {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  // WAL: readers (history queries) don't block the once-a-minute writer, and
  // a power cut can't leave half a transaction behind.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      source TEXT NOT NULL,
      name   TEXT NOT NULL,
      PRIMARY KEY (source, name)
    );
    CREATE TABLE IF NOT EXISTS apps (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      url         TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT ''
    );
    -- Each app's icon, cached; data NULL = looked and found none.
    CREATE TABLE IF NOT EXISTS app_icons (
      app_id     INTEGER PRIMARY KEY REFERENCES apps (id) ON DELETE CASCADE,
      url        TEXT NOT NULL,    -- the app URL it was found for
      type       TEXT,
      data       BLOB,
      fetched_at INTEGER NOT NULL
    );
    -- One row per minute: averages, plus the peak for CPU and temperature.
    CREATE TABLE IF NOT EXISTS metrics (
      ts       INTEGER PRIMARY KEY, -- minute start, ms since epoch
      cpu      REAL NOT NULL,
      cpu_max  REAL NOT NULL,
      temp     REAL NOT NULL,
      temp_max REAL NOT NULL,
      ram      REAL NOT NULL,
      disk     REAL NOT NULL,
      rx       REAL NOT NULL,
      tx       REAL NOT NULL
    );
  `);
  return db;
}
