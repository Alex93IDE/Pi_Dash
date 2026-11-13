// The HTTP API. Reads are GET; anything that changes something is a POST,
// PUT or DELETE with a JSON body.
import { Router, type NextFunction, type Request, type Response } from "express";
import { HISTORY_RANGES, type HistoryRange, type UnitSource } from "../../shared/types.ts";
import type { Apps } from "./apps.ts";
import { validateApp } from "./apps.ts";
import { BadRequest } from "./errors.ts";
import type { History } from "./history.ts";
import type { Icons } from "./icons.ts";
import type { Hub, Publisher } from "./hub.ts";
import * as pironman from "./pironman.ts";
import { checkAction, isSource, runAction, type Favorites } from "./units.ts";

type Deps = {
  hub: Hub;
  favorites: Favorites;
  apps: Apps;
  icons: Icons;
  history: History;
  publishers: {
    systemd: Publisher<"services">;
    docker: Publisher<"docker">;
    fast: Publisher<"fast">;
    apps: Publisher<"apps">;
  };
};

/**
 * There is no login, so the one thing worth stopping is another web page
 * open in the same browser quietly POSTing to the Pi. Browsers always send
 * Origin on cross-site requests; if it's there, it must be this server.
 */
export function sameOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (req.method === "GET" || req.method === "HEAD" || !origin) return next();
  try {
    if (new URL(origin).host === req.headers.host) return next();
  } catch {
    // fall through
  }
  res.status(403).json({ error: "Cross-origin request refused" });
}

/** Mutating requests must be JSON — which a plain HTML form can't send. */
function requireJson(req: Request, _res: Response, next: NextFunction): void {
  if (["POST", "PUT"].includes(req.method) && !req.is("application/json")) {
    return next(new BadRequest("Expected a JSON body"));
  }
  next();
}

export function apiRouter({ hub, favorites, apps, icons, history, publishers }: Deps): Router {
  const r = Router();
  r.use(sameOrigin, requireJson);

  const unitList = (source: UnitSource) => (source === "systemd" ? hub.get("services") : hub.get("docker")) ?? [];
  const unitPublisher = (source: UnitSource) => (source === "systemd" ? publishers.systemd : publishers.docker);

  function unitSource(req: Request): UnitSource {
    if (!isSource(req.params.source)) throw new BadRequest(`Unknown source: ${req.params.source}`);
    return req.params.source;
  }

  // ── Live data ──────────────────────────────────────────
  r.get("/stream", (_req, res) => hub.subscribe(res));

  // ── Pironman5 case ─────────────────────────────────────
  r.post("/pironman", async (req, res) => {
    await pironman.handle(req.body ?? {});
    // Show the new state within a moment, not on the next fast tick.
    publishers.fast.trigger();
    res.status(204).end();
  });

  // ── Services and containers ────────────────────────────
  r.put("/units/:source/:name/favorite", (req, res) => {
    const source = unitSource(req);
    const name = String(req.params.name);
    const value = req.body?.value;
    if (typeof value !== "boolean") throw new BadRequest("value must be true or false");
    // Only accept names that actually exist, so the table can't fill with junk.
    if (!unitList(source).some((u) => u.name === name)) throw new BadRequest(`Unknown ${source} name: ${name}`);
    favorites.set(source, name, value);
    unitPublisher(source).trigger();
    res.status(204).end();
  });

  r.post("/units/:source/:name/:action", async (req, res) => {
    const source = unitSource(req);
    const name = String(req.params.name);
    const action = checkAction(source, name, req.params.action, unitList(source));
    console.log(`[units] ${action} ${source} ${name}`);
    const error = await runAction(source, name, action);
    unitPublisher(source).trigger();
    if (error) {
      console.warn(`[units] ${action} ${name} failed: ${error}`);
      res.status(500).json({ error });
    } else {
      res.status(204).end();
    }
  });

  // ── History ────────────────────────────────────────────
  r.get("/history", (req, res) => {
    const range = String(req.query.range ?? "1h");
    if (!(HISTORY_RANGES as readonly string[]).includes(range)) throw new BadRequest(`Unknown range: ${range}`);
    res.json(history.query(range as HistoryRange));
  });

  // ── Apps ───────────────────────────────────────────────
  const appId = (req: Request) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequest("Bad id");
    return id;
  };

  r.get("/apps", (_req, res) => {
    res.json(apps.list());
  });
  r.post("/apps", (req, res) => {
    res.status(201).json(apps.create(validateApp(req.body ?? {})));
    // Check the new one straight away rather than in up to 30 s.
    publishers.apps.trigger();
  });
  r.put("/apps/:id", (req, res) => {
    const id = appId(req);
    const input = validateApp(req.body ?? {});
    if (!apps.update(id, input)) return void res.status(404).json({ error: "No such app" });
    publishers.apps.trigger();
    res.json({ id, ...input });
  });
  // The app's own icon, found and cached by the server. 404 = use the initial.
  r.get("/apps/:id/icon", async (req, res) => {
    const app = apps.get(appId(req));
    const icon = app && (await icons.get(app.id, app.url));
    if (!icon) return void res.status(404).end();
    res.set({
      "Content-Type": icon.type,
      // The URL carries the app's URL as a version, so a day is safe.
      "Cache-Control": "public, max-age=86400",
      // An SVG opened on its own must not be able to run anything.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(Buffer.from(icon.data));
  });
  r.delete("/apps/:id", (req, res) => {
    if (!apps.remove(appId(req))) return void res.status(404).json({ error: "No such app" });
    publishers.apps.trigger();
    res.status(204).end();
  });

  r.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Express 5 sends thrown and rejected errors here.
  r.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof BadRequest || (err as { type?: string }).type === "entity.parse.failed") {
      res.status(400).json({ error: err.message });
    } else {
      console.error("[api]", err);
      res.status(500).json({ error: err.message || "Internal error" });
    }
  });

  return r;
}
