/**
 * Lean list reads for the screens that only need counts and progress.
 *
 * A full WordList carries every reading passage, gloss and history entry the
 * AI has ever written for it. A tab that renders "12 words" should not pay for
 * that, so this projects the list down to name, timestamps, unit-path progress
 * and the per-word skill state the mastery helpers work on.
 */

import { connectDB } from "@/lib/db";
import {
  SKILL_IDS,
  WordList,
  normalizePathProgress,
  toSkillState,
  type PathProgress,
  type WordSkills,
} from "@/lib/models/WordList";

/** The fields a summary needs. Everything else stays in Mongo. */
const SUMMARY_FIELDS = "name updatedAt pathProgress words.word words.skills";

export type SummaryWord = { word: string; skills: WordSkills };

export type ListSummary = {
  _id: string;
  name: string;
  updatedAt: string; // ISO
  wordCount: number;
  pathProgress: PathProgress;
  words: SummaryWord[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSummary(doc: any): ListSummary {
  const words: unknown[] = Array.isArray(doc?.words) ? doc.words : [];
  return {
    _id: String(doc._id),
    name: String(doc?.name ?? ""),
    updatedAt: doc?.updatedAt
      ? new Date(doc.updatedAt).toISOString()
      : new Date().toISOString(),
    wordCount: words.length,
    pathProgress: normalizePathProgress(doc?.pathProgress),
    words: words.map((raw) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = raw as any;
      const skills = {} as WordSkills;
      for (const id of SKILL_IDS) skills[id] = toSkillState(w?.skills?.[id]);
      return { word: String(w?.word ?? ""), skills };
    }),
  };
}

/** Every list, newest first, with only what a summary card renders. */
export async function getListSummaries(): Promise<ListSummary[]> {
  await connectDB();
  const docs = await WordList.find()
    .select(SUMMARY_FIELDS)
    .sort({ updatedAt: -1 })
    .lean();
  return docs.map(toSummary);
}
