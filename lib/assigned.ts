/**
 * What a child may start right now, and nothing else: the beats of today's
 * quest he has not done, and the drill the Drill tab suggests. Everything else
 * that pays XP (a unit's steps, a chosen drill, a math skill picked off the
 * list, times tables, Words to fix, "Again" on a finished beat) is a single
 * item he could repeat for points, so it is closed to him (the parent's call,
 * 2026-10-04). A grown-up with the PIN can still open anything.
 *
 * Pure: the pages work out the quest and the suggestion, this says whether a
 * request is one of them.
 */

export type Assigned = {
  /** Links of the quest beats not done today. */
  quest: readonly string[];
  /** The suggested drill's link, or null when there is nothing to suggest. */
  drill: string | null;
};

/** The quest beats he may still open: those not done today that have somewhere to go. */
export function questHrefs(beats: readonly { done: boolean; href: string | null }[]): string[] {
  return beats.filter((b) => !b.done && b.href !== null).map((b) => b.href as string);
}

/** A unit's reading step, whichever unit: /learn/<list>/read. */
const READ_STEP = /^\/learn\/[^/]+\/read$/;

/** The parameters that pick the drill; the seed only deals its questions. */
function drillKey(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([k]) => k !== "seed")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

/**
 * Whether the page at `path` with `search` is one he was handed. A quest beat
 * matches on its path (the beat pages add ?r or ?saved themselves). The
 * Reading beat is any unit's reading: when his unit has nothing to read, the
 * beat sends him to a passage on another list. The drill must match the
 * suggestion in everything but its seed.
 */
export function isAssigned(path: string, search: URLSearchParams, assigned: Assigned): boolean {
  for (const href of assigned.quest) {
    const beatPath = href.split("?")[0];
    if (beatPath === path) return true;
    if (READ_STEP.test(beatPath) && READ_STEP.test(path)) return true;
  }
  if (assigned.drill) {
    const [drillPath, query = ""] = assigned.drill.split("?");
    if (drillPath === path && drillKey(new URLSearchParams(query)) === drillKey(search)) return true;
  }
  return false;
}
