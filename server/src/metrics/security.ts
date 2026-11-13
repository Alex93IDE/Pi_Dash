// Fail2ban and CrowdSec ban counters, and the ufw ruleset.
import type { UfwRule } from "../../../shared/types.ts";
import { CS_ENABLE, F2B_JAIL } from "../config.ts";
import { sudo } from "../shell.ts";

const UFW_RULE = /^\[\s*(\d+)\]\s+(.+?)\s+(ALLOW|DENY|REJECT|LIMIT)\s+(IN|OUT|FWD)\s+(.+)$/;

/** `ufw status numbered` output -> [status, rules]. */
export function parseUfw(text: string): [string, UfwRule[]] {
  const lines = text.split("\n");
  // "Status: inactive" contains "active", so compare the word itself.
  let status = "inactive";
  if (lines[0]?.toLowerCase().startsWith("status:")) {
    status = lines[0].split(":")[1].trim().toLowerCase();
  }
  const rules: UfwRule[] = [];
  for (const line of lines) {
    const m = UFW_RULE.exec(line.trim());
    if (!m) continue;
    rules.push({ num: Number(m[1]), to: m[2].trim(), action: `${m[3]} ${m[4]}`, from: m[5].trim() });
  }
  return [status, rules];
}

/** `fail2ban-client status <jail>` output -> currently banned count. */
export function parseF2b(text: string): number {
  const line = text.split("\n").find((l) => l.includes("Currently banned"));
  const n = Number(line?.trim().split(/\s+/).at(-1));
  return Number.isFinite(n) ? n : 0;
}

/** `cscli decisions list -o json` output -> active ban count. */
export function parseCrowdsec(text: string): number {
  try {
    const alerts = JSON.parse(text) as { decisions?: { type?: string }[] }[] | null;
    return (alerts ?? []).reduce(
      (n, a) => n + (a.decisions ?? []).filter((d) => d.type === "ban").length,
      0,
    );
  } catch {
    return 0;
  }
}

export async function collect() {
  const [ufw, f2b, cs] = await Promise.all([
    sudo("ufw", ["status", "numbered"]),
    F2B_JAIL ? sudo("fail2ban-client", ["status", F2B_JAIL]) : Promise.resolve(""),
    CS_ENABLE ? sudo("cscli", ["decisions", "list", "-o", "json"]) : Promise.resolve(""),
  ]);
  const [ufw_status, ufw_rules] = parseUfw(ufw);
  return {
    f2b_bans: parseF2b(f2b),
    cs_bans: parseCrowdsec(cs),
    ufw_status,
    ufw_rules,
  };
}
