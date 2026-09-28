/**
 * The brothers' tug of war, stored once for the family in Nour's database
 * (the main one; Wissam's only holds his own progress). Settled lazily: the
 * first page that needs it after midnight counts the finished days since the
 * last count, from both boys' activity logs.
 *
 * Server-only: these touch Mongo.
 */

import { todayKey } from "@/lib/day";
import { connectDB } from "@/lib/db";
import { freshRivalry, rivalryView, type Rivalry } from "@/lib/rivalry";
import { winXp } from "@/lib/scoreboard";
import type { ProfileState } from "@/lib/types";

type Doc = { _id: string } & Rivalry;

const ID = "rivalry";

/**
 * The rivalry through yesterday, as shown. Stored only past the grace days
 * (see rivalryView). `family` is every child's profile.
 */
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
  const { store, shown } = rivalryView(before, todayKey(now), (day) =>
    Object.fromEntries(family.map(({ learner, state }) => [learner, winXp(state.activity, day)]))
  );
  if (!store) return shown;
  // Only lands on the count it read: two pages settling at once write once.
  if (stored) {
    await col.updateOne({ _id: ID, through: before.through }, { $set: store });
  } else {
    await col.insertOne({ _id: ID, ...store }).catch(() => undefined);
  }
  return shown;
}
