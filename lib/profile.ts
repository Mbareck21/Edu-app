import { connectDB } from "@/lib/db";
import { PROFILE_KEY, Profile, toProfileState } from "@/lib/models/Profile";
import type { ProfileState } from "@/lib/types";

/**
 * Read the one profile document, creating it with defaults the first time.
 * Returns the pure state so callers can hand it straight to rewards.ts.
 */
export async function getProfile(): Promise<ProfileState> {
  return (await getProfileWithSeen()).state;
}

/** A passage he has already been given. Server-only; see Profile.readingSeen. */
export type ReadingSeen = {
  title: string;
  opening: string;
  kind?: string;
  cast?: string;
};

/**
 * The same read, plus the reading-variety memory that never enters
 * ProfileState. The generate route needs both and was fetching the one
 * document twice on a route that already runs close to its time limit.
 */
export async function getProfileWithSeen(): Promise<{
  state: ProfileState;
  seen: ReadingSeen[];
}> {
  const doc = await readProfileDoc();
  const raw = (doc as { readingSeen?: ReadingSeen[] } | null)?.readingSeen;
  return { state: toProfileState(doc), seen: Array.isArray(raw) ? raw : [] };
}

async function readProfileDoc() {
  await connectDB();
  return Profile.findOneAndUpdate(
    { key: PROFILE_KEY },
    { $setOnInsert: { key: PROFILE_KEY } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  ).lean();
}

/** A profile write that keeps losing the race is a bug, not bad luck: one boy, one app. */
const UPDATE_TRIES = 5;

/**
 * Read the profile, change it, write it back — but only if nobody else wrote
 * it in between. Returns what `change` returned and what was stored.
 *
 * The write replaces whole fields (xp, streak, stats...) computed from the
 * read. When his phone flushed its offline queue while a lesson finished, two
 * requests read the same profile and the second write erased the first
 * session's XP, and both could pay the new-day streak bonus. So every write
 * bumps `rev` and only lands on the `rev` it read; on a clash, `change` runs
 * again on the fresh profile. Keep `change` pure — it can run more than once.
 */
export async function updateProfile<T extends { profile: ProfileState }>(
  change: (current: ProfileState) => T
): Promise<{ changed: T; saved: ProfileState }> {
  for (let attempt = 0; attempt < UPDATE_TRIES; attempt++) {
    const doc = await readProfileDoc();
    // Profiles written before `rev` existed have no field to match yet.
    const unchanged =
      typeof doc?.rev === "number" ? { rev: doc.rev } : { rev: { $exists: false } };
    const changed = change(toProfileState(doc));
    const state = changed.profile;
    const saved = await Profile.findOneAndUpdate(
      { key: PROFILE_KEY, ...unchanged },
      {
        $set: {
          name: state.name,
          xp: state.xp,
          streak: state.streak,
          dailyGoal: state.dailyGoal,
          today: state.today,
          badges: state.badges.map((b) => ({ id: b.id, earnedAt: new Date(b.earnedAt) })),
          stats: state.stats,
          activity: state.activity.map((a) => ({ ...a, at: new Date(a.at) })),
          reading: {
            level: state.reading.level,
            recent: state.reading.recent.map((r) => ({ ...r, at: new Date(r.at) })),
          },
        },
        $inc: { rev: 1 },
      },
      { returnDocument: "after" }
    ).lean();
    if (saved) return { changed, saved: toProfileState(saved) };
  }
  throw new Error(`profile changed under every one of ${UPDATE_TRIES} tries`);
}
