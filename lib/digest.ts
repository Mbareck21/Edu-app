/**
 * The parent's week, in numbers that already exist elsewhere in the app.
 *
 * Every section keeps its own progress: words on the lists, tables on their
 * facts, spelling on its chains, sessions on the profile. His father was
 * opening each one in turn to see how the week went. This folds them into
 * one card on the Me tab. Pure: hand it the rows, get the numbers.
 */

import { wordKnowledge } from "@/lib/mastery";
import type { ClientWord } from "@/lib/models/WordList";
import { MS_PER_DAY } from "@/lib/spacing";
import { checkDue, isFinished, type ChainState } from "@/lib/spell-chain";
import { isDue, isKnown, type FactState } from "@/lib/tables";
import type { ActivityEntry, SessionKind } from "@/lib/types";

export const WEEK_MS = 7 * MS_PER_DAY;

export type KindSummary = { sessions: number; pct: number | null };

export type Digest = {
  sessions: number;
  minutes: number;
  byKind: Record<SessionKind, KindSummary>;
  /** Words at known or better whose last practice was this week. */
  wordsKnownThisWeek: number;
  tablesLit: number;
  /** What falls due by this time tomorrow. */
  dueTomorrow: { words: number; facts: number; checks: number };
};

export type DigestInput = {
  activity: ActivityEntry[];
  words: ClientWord[];
  facts: FactState[];
  chains: ChainState[];
  now: Date;
};

const KINDS: SessionKind[] = ["vocab", "math", "reading"];

function summarise(entries: ActivityEntry[]): KindSummary {
  if (entries.length === 0) return { sessions: 0, pct: null };
  const pct = entries.reduce((sum, e) => sum + e.pct, 0) / entries.length;
  return { sessions: entries.length, pct: Math.round(pct) };
}

export function buildDigest({ activity, words, facts, chains, now }: DigestInput): Digest {
  const weekStart = now.getTime() - WEEK_MS;
  const tomorrow = new Date(now.getTime() + MS_PER_DAY);
  const tomorrowIso = tomorrow.toISOString();

  const week = activity.filter((a) => {
    const t = new Date(a.at).getTime();
    return Number.isFinite(t) && t >= weekStart && t <= now.getTime();
  });
  const byKind = Object.fromEntries(
    KINDS.map((k) => [k, summarise(week.filter((a) => a.kind === k))])
  ) as Record<SessionKind, KindSummary>;
  const minutes = Math.round(week.reduce((sum, a) => sum + a.ms, 0) / 60_000);

  const wordsKnownThisWeek = words.filter((w) => {
    const knowledge = wordKnowledge(w);
    if (knowledge !== "known" && knowledge !== "mastered") return false;
    const last = Math.max(
      ...Object.values(w.skills).map((s) => (s.lastAt ? new Date(s.lastAt).getTime() : 0))
    );
    return last >= weekStart;
  }).length;

  const dueWords = words.filter((w) =>
    Object.values(w.skills).some((s) => new Date(s.dueAt).getTime() <= tomorrow.getTime())
  ).length;
  const dueFacts = facts.filter((f) => f.correct + f.wrong > 0 && isDue(f, tomorrowIso)).length;
  const dueChecks = chains.filter((c) => isFinished(c) && checkDue(c, tomorrowIso)).length;

  return {
    sessions: week.length,
    minutes,
    byKind,
    wordsKnownThisWeek,
    tablesLit: facts.filter(isKnown).length,
    dueTomorrow: { words: dueWords, facts: dueFacts, checks: dueChecks },
  };
}
