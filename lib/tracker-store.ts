/**
 * The tracker's copy of each child's sessions, on that child's own database
 * ("tracked" collection), so the competition report outlives the capped
 * activity log. See lib/tracker.ts.
 *
 * Server-only: these touch Mongo.
 */

import { todayKey } from "@/lib/day";
import { learnerModels } from "@/lib/db";
import type { LearnerId } from "@/lib/learners";
import { toTrack, trackedId, type Tracked } from "@/lib/tracker";
import type { ActivityEntry } from "@/lib/types";

type TrackedDoc = Omit<Tracked, "at"> & { _id: string; at: Date; day: string };

async function trackedOf(learner: LearnerId) {
  const { Profile } = await learnerModels(learner);
  const native = Profile.db.db;
  if (!native) throw new Error("database not connected");
  return native.collection<TrackedDoc>("tracked");
}

/**
 * Copy every session since the competition began that the tracker does not
 * have yet. Sessions never change once logged, so a copy is only ever added.
 * Run after each session and when the report opens, so the early days are
 * copied before the activity log lets them go.
 */
export async function trackActivity(learner: LearnerId, activity: readonly ActivityEntry[]): Promise<void> {
  const entries = toTrack(activity);
  if (entries.length === 0) return;
  const col = await trackedOf(learner);
  const have = new Set(
    (await col.find({ _id: { $in: entries.map(trackedId) } }, { projection: { _id: 1 } }).toArray()).map((d) => d._id)
  );
  const fresh = entries.filter((a) => !have.has(trackedId(a)));
  if (fresh.length === 0) return;
  await col.bulkWrite(
    fresh.map((a) => ({
      updateOne: {
        filter: { _id: trackedId(a) },
        update: {
          $setOnInsert: {
            at: new Date(a.at),
            day: todayKey(new Date(a.at)),
            kind: a.kind,
            ref: a.ref,
            pct: a.pct,
            xp: a.xp,
            ms: a.ms,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );
}

/** Every tracked session from `from` (YYYY-MM-DD), oldest first. */
export async function loadTracked(learner: LearnerId, from: string): Promise<Tracked[]> {
  const col = await trackedOf(learner);
  const docs = await col.find({ day: { $gte: from } }).sort({ at: 1 }).toArray();
  return docs.map((d) => ({
    at: new Date(d.at).toISOString(),
    kind: d.kind,
    ref: String(d.ref),
    pct: Number(d.pct) || 0,
    xp: Number(d.xp) || 0,
    ms: Number(d.ms) || 0,
  }));
}
