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
  await connectDB();
  const doc = await Profile.findOneAndUpdate(
    { key: PROFILE_KEY },
    { $setOnInsert: { key: PROFILE_KEY } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  ).lean();
  const raw = (doc as { readingSeen?: ReadingSeen[] } | null)?.readingSeen;
  return { state: toProfileState(doc), seen: Array.isArray(raw) ? raw : [] };
}

/** Write the whole profile state back. Returns what was stored. */
export async function saveProfile(state: ProfileState): Promise<ProfileState> {
  await connectDB();
  const doc = await Profile.findOneAndUpdate(
    { key: PROFILE_KEY },
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
      $setOnInsert: { key: PROFILE_KEY },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  ).lean();
  return toProfileState(doc);
}
