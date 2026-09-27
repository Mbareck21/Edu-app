/**
 * The brothers' tug of war, stored once for the family in Nour's database
 * (the main one; Wissam's only holds his own progress). Settled lazily: the
 * first page that needs it after midnight counts the finished days since the
 * last count, from both boys' activity logs.
 *
 * Server-only: these touch Mongo.
 */

import { addDays, todayKey } from "@/lib/day";
import { connectDB } from "@/lib/db";
import { freshRivalry, settleThrough, type Rivalry } from "@/lib/rivalry";
import { dayXp } from "@/lib/scoreboard";
import type { ProfileState } from "@/lib/types";

type Doc = { _id: string } & Rivalry;

const ID = "rivalry";

/** The rivalry settled through yesterday. `family` is every child's profile. */
export async function currentRivalry(
  family: readonly { learner: string; state: ProfileState }[],
  now: Date = new Date()
): Promise<Rivalry> {
  const m = await connectDB();
  const col = m.connection.db!.collection<Doc>("family");
  const stored = await col.findOne({ _id: ID });
  const before: Rivalry = stored
    ? { through: stored.through, holder: stored.holder, points: stored.points }
    : freshRivalry();
  const yesterday = addDays(todayKey(now), -1);
  if (before.through >= yesterday) return before;

  const after = settleThrough(before, yesterday, (day) =>
    Object.fromEntries(family.map(({ learner, state }) => [learner, dayXp(state.activity, day)]))
  );
  // Only lands on the count it read: two pages settling at once write once.
  if (stored) {
    await col.updateOne({ _id: ID, through: before.through }, { $set: after });
  } else {
    await col.insertOne({ _id: ID, ...after }).catch(() => undefined);
  }
  return after;
}
