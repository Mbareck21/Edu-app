// Local-day helpers. The kid's day boundary is his timezone, not the server's.

const TZ = process.env.KID_TZ ?? "America/Chicago";

/** YYYY-MM-DD for `now` in the kid's timezone. */
export function todayKey(now: Date = new Date(), timeZone: string = TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The day before a YYYY-MM-DD key. Pure string math, no timezone involved. */
export function previousDay(key: string): string {
  const t = Date.parse(`${key}T00:00:00Z`);
  if (Number.isNaN(t)) return "";
  return new Date(t - 86_400_000).toISOString().slice(0, 10);
}

/** Last 7 day keys ending at `key`, oldest first. */
export function lastSevenDays(key: string): string[] {
  const out: string[] = [];
  let cur = key;
  for (let i = 0; i < 7; i++) {
    out.unshift(cur);
    cur = previousDay(cur);
  }
  return out;
}

/** The day `n` days after a YYYY-MM-DD key. Pure string math, like previousDay. */
export function addDays(key: string, n: number): string {
  const t = Date.parse(`${key}T00:00:00Z`);
  if (Number.isNaN(t)) return "";
  return new Date(t + n * 86_400_000).toISOString().slice(0, 10);
}

/** How far the zone's wall clock is ahead of UTC at `at`, in ms (negative in Chicago). */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The moment a YYYY-MM-DD day begins in the kid's timezone. The offset is read
 * twice so a clock change between UTC midnight and local midnight still lands
 * on local midnight.
 */
export function startOfDay(key: string, timeZone: string = TZ): Date {
  const utc = Date.parse(`${key}T00:00:00Z`);
  if (Number.isNaN(utc)) return new Date(NaN);
  let t = utc - zoneOffsetMs(new Date(utc), timeZone);
  t = utc - zoneOffsetMs(new Date(t), timeZone);
  return new Date(t);
}
