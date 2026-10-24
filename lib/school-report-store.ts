/**
 * Each child's school report card, on that child's own database
 * ("school_report" collection, one document per school year). This is the
 * only place it is read or written, and it never leaves that database: the
 * repo is public. See lib/school-report.ts for what a card is and does.
 *
 * Server-only: these touch Mongo.
 */

import { currentLearner } from "@/lib/auth";
import { todayKey } from "@/lib/day";
import { learnerModels } from "@/lib/db";
import type { LearnerId } from "@/lib/learners";
import { SCHOOL_YEAR_ID, focusFor, parseReport, type SchoolFocus, type SchoolReport } from "@/lib/school-report";

type StoredCard = SchoolReport & { _id: string; v: 1; updatedAt: Date };

async function cardsOf(learner: LearnerId) {
  const { Profile } = await learnerModels(learner);
  const native = Profile.db.db;
  if (!native) throw new Error("database not connected");
  return native.collection<StoredCard>("school_report");
}

/**
 * This school year's card, or null when none has been saved. A stored card
 * that no longer reads (a later release dropped a row) is logged and treated
 * as no card: a bad card must never stop the quest.
 */
export async function loadReport(learner: LearnerId): Promise<SchoolReport | null> {
  const doc = await (await cardsOf(learner)).findOne({ _id: SCHOOL_YEAR_ID });
  if (!doc) return null;
  const { _id, v, updatedAt, ...card } = doc;
  void _id;
  void v;
  void updatedAt;
  const parsed = parseReport(card);
  if (!parsed.ok) {
    console.error(`[school-report] ${learner}'s stored card does not read: ${parsed.error}`);
    return null;
  }
  return parsed.report;
}

/** The whole card, replaced: saving the same card twice leaves the same card. */
export async function saveReport(learner: LearnerId, report: SchoolReport): Promise<void> {
  await (await cardsOf(learner)).replaceOne(
    { _id: SCHOOL_YEAR_ID },
    { ...report, v: 1, updatedAt: new Date() },
    { upsert: true }
  );
}

/** What the signed-in child's card changes today. NO_FOCUS without a card. */
export async function loadFocus(today: string = todayKey()): Promise<SchoolFocus> {
  return focusFor(await loadReport(await currentLearner()), today);
}
