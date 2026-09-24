/**
 * The children who use the app. Each one signs in with their own PIN and has
 * their own database: progress, streaks, math levels and Stuck words never
 * mix. Word lists are shared — a list either one adds shows up for both (see
 * lib/shared-lists.ts), and only the one who added it can delete it.
 *
 * Pure: safe to import from client components.
 */

export const LEARNER_IDS = ["nour", "wissam"] as const;
export type LearnerId = (typeof LEARNER_IDS)[number];

export const LEARNER_NAMES: Record<LearnerId, string> = {
  nour: "Nour",
  wissam: "Wissam",
};

/** Nour used the app alone before; anything with no owner is his. */
export function ownerOf(addedBy: unknown): LearnerId {
  return isLearnerId(addedBy) ? addedBy : "nour";
}

export function isLearnerId(v: unknown): v is LearnerId {
  return typeof v === "string" && (LEARNER_IDS as readonly string[]).includes(v);
}

/** Which child a PIN signs in. Each PIN lives in the environment, not the repo. */
export function learnerForPin(
  pin: string,
  env: Record<string, string | undefined> = process.env
): LearnerId | null {
  if (env.PARENT_PIN && pin === env.PARENT_PIN) return "nour";
  if (env.WISSAM_PIN && pin === env.WISSAM_PIN) return "wissam";
  return null;
}
