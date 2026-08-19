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
