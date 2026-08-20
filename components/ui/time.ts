/** mm:ss from milliseconds. The one clock format the runners share. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * One seed per request: the pages that use it are dynamic, so every visit
 * builds a fresh lesson, drill or question set. Wrapping `Date.now()` also
 * keeps the purity lint happy — a page may not call it during render.
 */
export function requestSeed(): number {
  return Date.now();
}

export default clock;
