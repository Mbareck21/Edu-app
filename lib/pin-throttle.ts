// Wrong-PIN throttle for the sign-in and grown-ups PIN routes.
//
// The PINs are four digits, so all ten thousand can be tried in under a
// minute; only failures are counted, so getting it right never costs anything.
// Counted per device AND per home address. Per address alone, one boy's eight
// misses locked his brother out on his own phone for ten minutes, and a child
// could keep a parent out of the grown-ups page by missing on purpose. Per
// device alone, a script that drops its cookie each time would never be
// slowed. So a device stops at DEVICE_LIMIT, and the whole address at a
// looser HOME_LIMIT that still turns "a minute" into days.
//
// In-memory: it resets when the server instance does, as before.

export const PIN_WINDOW_MS = 10 * 60 * 1000;
export const DEVICE_LIMIT = 8;
export const HOME_LIMIT = 24;

/** Failure times by key. Each route keeps its own. */
export type PinFailures = Map<string, number[]>;

function recent(fails: PinFailures, key: string, now: number): number[] {
  const kept = (fails.get(key) ?? []).filter((t) => t > now - PIN_WINDOW_MS);
  if (kept.length > 0) fails.set(key, kept);
  else fails.delete(key);
  return kept;
}

/** Seconds until this device may try again, or 0 when it may try now. */
export function pinWait(fails: PinFailures, device: string, ip: string, now: number): number {
  const waits: number[] = [];
  for (const [key, limit] of [[`device:${device}`, DEVICE_LIMIT], [`home:${ip}`, HOME_LIMIT]] as const) {
    const times = recent(fails, key, now);
    if (times.length >= limit) waits.push(Math.ceil((times[times.length - limit] + PIN_WINDOW_MS - now) / 1000));
  }
  return waits.length > 0 ? Math.max(1, ...waits) : 0;
}

export function recordPinMiss(fails: PinFailures, device: string, ip: string, now: number): void {
  for (const key of [`device:${device}`, `home:${ip}`]) {
    fails.set(key, [...recent(fails, key, now), now]);
  }
}

/** The right PIN: this device starts clean. The address keeps its count. */
export function clearPinMisses(fails: PinFailures, device: string): void {
  fails.delete(`device:${device}`);
}

/** The cookie that names this phone for the throttle. Not a sign-in. */
export const DEVICE_COOKIE = "eduapp_device";

/** A device id from the cookie, or a new one when there is none or it is odd. */
export function deviceIdFrom(cookie: string | undefined): { id: string; isNew: boolean } {
  if (cookie && /^[a-f0-9-]{16,64}$/i.test(cookie)) return { id: cookie, isNew: false };
  return { id: crypto.randomUUID(), isNew: true };
}
