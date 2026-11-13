// Optional PIN for actions that change things on the Pi (start/stop/restart,
// editing apps). Not a login: looking stays open, acting needs the PIN.
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const MAX_FAILURES = 5;
const LOCKOUT_MS = 5 * 60_000;

const digest = (s: string) => createHash("sha256").update(s).digest();

/**
 * Express middleware checking the X-Pin header. A short PIN is easy to guess,
 * so after a few wrong tries everyone is locked out for a while — guessing a
 * 6-digit PIN then takes years instead of minutes.
 */
export function pinGuard(pin: string, now = () => Date.now()) {
  const expected = digest(pin);
  let failures = 0;
  let lockedUntil = 0;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!pin) return next();
    if (now() < lockedUntil) {
      const mins = Math.ceil((lockedUntil - now()) / 60_000);
      return void res.status(429).json({ error: `Too many wrong PINs — try again in ${mins} min`, code: "pin_locked" });
    }
    const given = req.get("x-pin");
    if (given === undefined) {
      return void res.status(401).json({ error: "PIN required", code: "pin" });
    }
    // Comparing digests keeps the time taken independent of the PIN.
    if (!timingSafeEqual(digest(given), expected)) {
      if (++failures >= MAX_FAILURES) {
        failures = 0;
        lockedUntil = now() + LOCKOUT_MS;
        console.warn("[pin] too many wrong PINs, locked for 5 min");
      }
      return void res.status(401).json({ error: "Wrong PIN", code: "pin" });
    }
    failures = 0;
    next();
  };
}
