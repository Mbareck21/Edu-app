// Where he stands on the long goals, for the Set 3 badges. Badge.check sees
// only the profile and this session, while words known, the times-table grid
// and the math levels live in their own collections. So the API reads them
// once, after this session's progress is written and before the badges are
// checked, and hands them in as SessionResult.mastery.
//
// Server-only: loadMasterySnapshot touches Mongoose. masterySnapshot is pure.

import { db } from "@/lib/db";
import { countKnown, uniqueWords } from "@/lib/mastery";
import { MATH_SKILL_IDS } from "@/lib/math/skills";
import { toClientMathProgress } from "@/lib/models/MathProgress";
import type { ClientWord } from "@/lib/models/WordList";
import {
  TABLES,
  TABLE_UP_TO,
  allFactKeys,
  factFromRow,
  isKnown,
  isLit,
  tableProgress,
  type FactState,
} from "@/lib/tables";
import type { MasterySnapshot } from "@/lib/types";
import { getUnits } from "@/lib/word-source";

export function masterySnapshot(input: {
  /** Words from his school lists, not the Stuck words pool. */
  words: ClientWord[];
  facts: Record<string, FactState>;
  /** Stored level by math skill id. */
  mathLevels: Record<string, number>;
}): MasterySnapshot {
  const facts = allFactKeys().flatMap((key) => (input.facts[key] ? [input.facts[key]] : []));
  return {
    wordsKnown: countKnown(uniqueWords(input.words)),
    factsLit: facts.filter(isLit).length,
    factsKnown: facts.filter(isKnown).length,
    factsGold: facts.filter((f) => isKnown(f) && f.lastFast).length,
    tablesKnown: TABLES.filter((t) => tableProgress(t, input.facts).known === TABLE_UP_TO).length,
    mathLevels: MATH_SKILL_IDS.map((id) => input.mathLevels[id] ?? 1),
  };
}

export async function loadMasterySnapshot(): Promise<MasterySnapshot> {
  const { MathProgress, TimesFact } = await db();
  const [lists, factRows, mathDocs] = await Promise.all([
    getUnits(),
    TimesFact.find().lean(),
    MathProgress.find().lean(),
  ]);
  const facts: Record<string, FactState> = {};
  for (const r of factRows) facts[r.key] = factFromRow(r.key, r);
  const mathLevels: Record<string, number> = {};
  for (const doc of mathDocs) {
    const p = toClientMathProgress(doc);
    mathLevels[p.skill] = p.level;
  }
  return masterySnapshot({ words: lists.flatMap((l) => l.words), facts, mathLevels });
}
