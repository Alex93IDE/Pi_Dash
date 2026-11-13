import type { DockerContainer, FavoriteSource, SystemdService } from "../stores/pi";

/** on = green, warn = amber, off = red, idle = grey. */
export type Tone = "on" | "warn" | "off" | "idle";

/**
 * A systemd unit or a Docker container, flattened to what the lists render.
 * `name` stays the raw identifier because favorite commands must match it exactly.
 */
export type UnitRow = {
  source: FavoriteSource;
  name: string;
  title: string;
  subtitle: string;
  status: string;
  tag?: string; // small neutral label, e.g. systemd's unit file state
  tone: Tone;
  favorite: boolean;
};

// `active` + `exited` is a oneshot that finished fine, so anything "active"
// is green regardless of the sub-state.
export function systemdTone(svc: SystemdService): Tone {
  switch (svc.active) {
    case "active":
      return "on";
    case "failed":
      return "off";
    case "activating":
    case "deactivating":
    case "reloading":
      return "warn";
    default:
      return "idle";
  }
}

export function dockerTone(c: DockerContainer): Tone {
  switch (c.state) {
    case "running":
      return "on";
    case "paused":
    case "restarting":
      return "warn";
    case "exited":
    case "dead":
      return "off";
    default:
      return "idle";
  }
}

export function systemdRow(svc: SystemdService): UnitRow {
  return {
    source: "systemd",
    name: svc.name,
    title: svc.name.replace(/\.service$/, ""),
    subtitle: svc.description,
    status: `${svc.active} · ${svc.sub}`,
    tag: svc.enabled || "—",
    tone: systemdTone(svc),
    favorite: svc.favorite,
  };
}

export function dockerRow(c: DockerContainer): UnitRow {
  return {
    source: "docker",
    name: c.name,
    title: c.name,
    subtitle: c.image,
    status: c.status,
    tone: dockerTone(c),
    favorite: c.favorite,
  };
}
