import { redirect } from "next/navigation";

import { modesFor, sourceCounts } from "@/components/drill/picks";
import { suggestionFor } from "@/components/drill/suggest";
import { db } from "@/lib/db";
import { toClientMathProgress } from "@/lib/models/MathProgress";
import { getProfile } from "@/lib/profile";
import { getPractice } from "@/lib/word-source";

export const dynamic = "force-dynamic";

/**
 * "Next drill" on every finish screen: the Drill tab's suggestion, worked out
 * afresh now that the drill just played is on the record, so one tap after
 * another turns through words and math. Nothing to suggest: the Drill tab.
 */
export default async function NextDrillPage() {
  const { MathProgress } = await db();
  const [practice, mathDocs, profile] = await Promise.all([
    getPractice(),
    MathProgress.find().lean(),
    getProfile(),
  ]);
  const now = new Date();
  const lists = practice
    .filter((l) => l.words.length > 0)
    .map((l) => ({ listId: l._id, name: l.name, words: l.words }));
  const counts = sourceCounts(lists, now);
  const suggestion = suggestionFor({
    weakWords: counts.weak,
    dueWords: counts.due,
    toGoWords: counts.all,
    wordModes: modesFor(counts.weakSkills),
    played: mathDocs.map((doc) => toClientMathProgress(doc)),
    activity: profile.activity,
    now,
  });
  redirect(suggestion?.href ?? "/drill");
}
