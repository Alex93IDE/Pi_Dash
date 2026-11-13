// systemd services and Docker containers: listing them, starring them, and
// starting / stopping / restarting them.
import type { DatabaseSync } from "node:sqlite";
import {
  UNIT_ACTIONS,
  type DockerContainer,
  type SystemdService,
  type UnitAction,
  type UnitSource,
} from "../../shared/types.ts";
import { PROTECTED_UNITS, UNIT_CONTROL } from "./config.ts";
import { BadRequest } from "./errors.ts";
import { run, runChecked, runJson } from "./shell.ts";

export const SOURCES: readonly UnitSource[] = ["systemd", "docker"];

// ── Favorites ────────────────────────────────────────────
export class Favorites {
  private db: DatabaseSync;
  constructor(db: DatabaseSync) {
    this.db = db;
  }

  names(source: UnitSource): Set<string> {
    const rows = this.db.prepare("SELECT name FROM favorites WHERE source = ?").all(source);
    return new Set(rows.map((r) => r.name as string));
  }

  set(source: UnitSource, name: string, value: boolean): void {
    this.db
      .prepare(
        value
          ? "INSERT OR IGNORE INTO favorites (source, name) VALUES (?, ?)"
          : "DELETE FROM favorites WHERE source = ? AND name = ?",
      )
      .run(source, name);
  }
}

// ── systemd ──────────────────────────────────────────────
type UnitJson = { unit: string; load?: string; active?: string; sub?: string; description?: string };
type UnitFileJson = { unit_file: string; state?: string };

export function enabledState(states: Map<string, string>, unit: string): string {
  if (states.has(unit)) return states.get(unit)!;
  // Instances like getty@tty1.service only have a template unit file.
  const at = unit.indexOf("@");
  return at > 0 ? (states.get(`${unit.slice(0, at)}@.service`) ?? "") : "";
}

export function toServices(units: UnitJson[], files: UnitFileJson[], favs: Set<string>): SystemdService[] {
  const states = new Map(files.map((f) => [f.unit_file, f.state ?? ""]));
  return (
    units
      // Units something references but that aren't installed.
      .filter((u) => u.load !== "not-found")
      .map((u) => ({
        name: u.unit,
        active: u.active ?? "",
        sub: u.sub ?? "",
        enabled: enabledState(states, u.unit),
        description: u.description ?? "",
        favorite: favs.has(u.unit),
      }))
  );
}

/** Every service unit systemd knows about, running or not. */
export async function listServices(favs: Set<string>): Promise<SystemdService[]> {
  const [units, files] = await Promise.all([
    runJson<UnitJson[]>("systemctl", ["list-units", "--type=service", "--all", "--output=json"]),
    runJson<UnitFileJson[]>("systemctl", ["list-unit-files", "--type=service", "--output=json"]),
  ]);
  return toServices(units ?? [], files ?? [], favs);
}

// ── Docker ───────────────────────────────────────────────
/** `docker ps -a --format '{{json .}}'` output -> container list. */
export function parseDockerPs(text: string, favs: Set<string>): DockerContainer[] {
  const out: DockerContainer[] = [];
  for (const line of text.split("\n")) {
    let c: Record<string, string>;
    try {
      c = JSON.parse(line);
    } catch {
      continue;
    }
    const name = c.Names ?? "";
    out.push({
      name,
      image: c.Image ?? "",
      state: c.State ?? "",
      status: c.Status ?? "",
      favorite: favs.has(name),
    });
  }
  return out;
}

/** Every container, running or not. Empty if Docker isn't there. */
export async function listContainers(favs: Set<string>): Promise<DockerContainer[]> {
  return parseDockerPs(await run("docker", ["ps", "-a", "--format", "{{json .}}"]), favs);
}

// ── Actions ──────────────────────────────────────────────
export function isSource(v: unknown): v is UnitSource {
  return (SOURCES as readonly unknown[]).includes(v);
}

/**
 * Check an action against the current list. Only names that actually exist
 * are accepted — so nothing that looks like an option ("--force") or a unit
 * that was never listed can get through.
 */
export function checkAction(
  source: UnitSource,
  name: string,
  action: unknown,
  known: { name: string }[],
): UnitAction {
  if (!UNIT_CONTROL) throw new BadRequest("Unit control is disabled (UNIT_CONTROL=false)");
  if (!(UNIT_ACTIONS as readonly unknown[]).includes(action)) {
    throw new BadRequest(`Unknown action: ${JSON.stringify(action)}`);
  }
  if (!known.some((u) => u.name === name)) throw new BadRequest(`Unknown ${source} name: ${name}`);
  if (source === "systemd" && action === "stop" && PROTECTED_UNITS.includes(name)) {
    throw new BadRequest(`${name} is protected: it can be restarted but not stopped`);
  }
  return action as UnitAction;
}

/**
 * Run it. systemctl needs no sudo: deploy/install.sh adds a polkit rule that
 * lets this user start, stop and restart units, and nothing else. Docker
 * works through the docker group. Returns the error text, or null.
 */
export function runAction(source: UnitSource, name: string, action: UnitAction): Promise<string | null> {
  return source === "systemd"
    ? runChecked("systemctl", ["--no-ask-password", action, name])
    : runChecked("docker", [action, name]);
}
