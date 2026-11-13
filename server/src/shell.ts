import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";

/**
 * Run a program and return its trimmed stdout, or "" on any failure.
 *
 * No shell is involved: arguments go straight to the program, so a value
 * from .env or a unit name can never turn into a second command.
 */
export function run(file: string, args: string[], timeout = 10_000): Promise<string> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      resolve(err ? "" : stdout.trim());
    });
  });
}

/**
 * run() as root via the sudoers rules deploy/install.sh sets up.
 *
 * -n makes sudo fail straight away instead of waiting for a password
 * nobody is going to type, if a rule is missing.
 */
export function sudo(file: string, args: string[]): Promise<string> {
  return run("sudo", ["-n", file, ...args]);
}

/** Like run() but returns the parsed JSON, or null on failure. */
export async function runJson<T>(file: string, args: string[]): Promise<T | null> {
  try {
    return JSON.parse(await run(file, args)) as T;
  } catch {
    return null;
  }
}

/** Contents of a small text file (sysfs, procfs), or "" if unreadable. */
export async function readText(path: string): Promise<string> {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return "";
  }
}

/**
 * Run a program and report whether it succeeded, with stderr on failure —
 * for actions the user asked for, where "why it failed" matters.
 */
export function runChecked(file: string, args: string[], timeout = 60_000): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout }, (err, _stdout, stderr) => {
      resolve(err ? stderr.trim() || err.message : null);
    });
  });
}
