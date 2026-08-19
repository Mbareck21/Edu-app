import { connectDB } from "@/lib/db";
import { PROFILE_KEY, Profile, toProfileState } from "@/lib/models/Profile";
import type { ProfileState } from "@/lib/types";

/**
 * Read the one profile document, creating it with defaults the first time.
 * Returns the pure state so callers can hand it straight to rewards.ts.
 */
export async function getProfile(): Promise<ProfileState> {
  await connectDB();
  const doc = await Profile.findOneAndUpdate(
    { key: PROFILE_KEY },
    { $setOnInsert: { key: PROFILE_KEY } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return toProfileState(doc);
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
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return toProfileState(doc);
}
