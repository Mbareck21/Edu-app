import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { currentLearner } from "@/lib/auth";
import { todayKey } from "@/lib/day";
import { db } from "@/lib/db";
import { LEARNER_IDS } from "@/lib/learners";
import { isStuckMiss, scheduleSkill } from "@/lib/mastery";
import { addPoolWords, getPool } from "@/lib/word-source";
import { applyRound } from "@/lib/models/MathProgress";
import { sessionPct } from "@/lib/session-score";
import {
  PROFILE_KEY,
  RECENT_SESSION_IDS,
  toClientProfile,
} from "@/lib/models/Profile";
import { SKILL_IDS, toSkillState } from "@/lib/models/WordList";
import { getProfile, updateProfile } from "@/lib/profile";
import { applyReading, applySession, levelFor } from "@/lib/rewards";
import { STEP_IDS, stepById } from "@/lib/types";
import type { SessionResult, StepId } from "@/lib/types";

export const runtime = "nodejs";

/** How far back a session sent late may still count for the day it was played. */
const MAX_BACKDATE_MS = 7 * 24 * 60 * 60 * 1000;

const Body = z.object({
  sessionId: z.string().min(8).max(64).optional(),
  learner: z.enum(LEARNER_IDS).optional(),
  playedAt: z.number().int().min(0).optional(),
  kind: z.enum(["vocab", "math", "reading"]),
  ref: z.string().min(1).max(120),
  answered: z.number().int().min(0).max(500),
  correct: z.number().int().min(0).max(500),
  fastCount: z.number().int().min(0).max(500),
  ms: z.number().int().min(0).max(6 * 60 * 60 * 1000),
  perfect: z.boolean(),
  timed: z.boolean().optional(),
  listId: z.string().min(1).max(64).optional(),
  step: z.enum(STEP_IDS).optional(),
  mathSkill: z.string().min(1).max(40).optional(),
  mathLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  wordResults: z
    .array(
      z.object({
        word: z.string().min(1).max(40),
        skill: z.enum(SKILL_IDS),
        correct: z.boolean(),
        listId: z.string().min(1).max(64).optional(),
      })
    )
    .max(200)
    .optional(),
  reading: z
    .object({
      level: z.number().int().min(1).max(10),
      pct: z.number().min(0).max(100),
      wordsCount: z.number().int().min(0).max(5000),
      wpm: z.number().int().min(0).max(1000).optional(),
    })
    .optional(),
});

type ParsedBody = z.infer<typeof Body>;

/** The one scoring rule — see lib/session-score.ts for why timed differs. */
function pctOf(body: ParsedBody): number {
  return sessionPct(body);
}

type WordResultIn = NonNullable<ParsedBody["wordResults"]>[number];

/**
 * Set just before the first progress write goes out. Until then nothing of
 * this session is stored anywhere, so a failure can safely give the claim back.
 */
type Writes = { started: boolean };

/** Each step carries its own mark; unscored ones complete just for showing up. */
function stepCompleted(step: StepId, pct: number): boolean {
  const info = stepById(step);
  return !info.scored || pct >= info.passPct;
}

/** The unit-path entry for the step the session just played. */
async function applyPathProgress(
  listId: string,
  step: StepId,
  body: ParsedBody,
  now: Date,
  writes: Writes
): Promise<void> {
  if (!mongoose.isValidObjectId(listId)) return;
  const { WordList } = await db();
  const doc = await WordList.findById(listId).select("pathProgress");
  if (!doc) return;

  const pct = pctOf(body);
  const prev = doc.pathProgress?.get(step);
  doc.pathProgress?.set(step, {
    completedAt: stepCompleted(step, pct) ? now : (prev?.completedAt ?? null),
    bestPct: Math.max(Number(prev?.bestPct) || 0, pct),
    plays: (Number(prev?.plays) || 0) + 1,
  });
  doc.markModified("pathProgress");
  writes.started = true;
  await doc.save();
}

type PoolWord = { word: string; clue: string; arabic: string };

/**
 * Per-word, per-skill answers for one list, in one read-modify-write. Words
 * he is stuck on (see isStuckMiss) are collected into `stuck`.
 */
async function applyWordResults(
  listId: string,
  results: WordResultIn[],
  now: Date,
  writes: Writes,
  stuck: Map<string, PoolWord>
): Promise<void> {
  if (results.length === 0) return;
  if (!mongoose.isValidObjectId(listId)) return;
  const { WordList } = await db();
  const doc = await WordList.findById(listId).select("words kind");
  if (!doc) return;

  const byWord = new Map<string, number>();
  doc.words.forEach((w, i) => byWord.set(String(w.word).toLowerCase(), i));
  let touched = false;
  for (const r of results) {
    const index = byWord.get(r.word.toLowerCase());
    if (index === undefined) continue;
    const skill = r.skill;
    const prev = toSkillState(doc.words[index].skills?.[skill], now);
    const next = scheduleSkill(prev, r.correct, now);
    if (doc.kind !== "pool" && isStuckMiss(prev, r.correct, now)) {
      const w = doc.words[index];
      stuck.set(String(w.word), { word: String(w.word), clue: w.clue ?? "", arabic: w.arabic ?? "" });
    }
    doc.set(`words.${index}.skills.${skill}`, {
      correct: next.correct,
      wrong: next.wrong,
      streak: next.streak,
      lastAt: next.lastAt ? new Date(next.lastAt) : null,
      dueAt: new Date(next.dueAt),
    });
    touched = true;
  }
  if (!touched) return;
  doc.markModified("words");
  writes.started = true;
  await doc.save();
}

/** Route each word result to its list; the session's own list also gets pathProgress. */
async function updateList(body: ParsedBody, now: Date, writes: Writes): Promise<void> {
  if (body.listId && body.step) {
    await applyPathProgress(body.listId, body.step, body, now, writes);
  }

  const groups = new Map<string, WordResultIn[]>();
  for (const r of body.wordResults ?? []) {
    const key = r.listId ?? body.listId;
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  // One document per group, so the writes cannot collide.
  const stuck = new Map<string, PoolWord>();
  await Promise.all(
    [...groups].map(([listId, results]) => applyWordResults(listId, results, now, writes, stuck))
  );
  // Missed twice running: into Words to fix, once, unless it is there already.
  if (stuck.size > 0) {
    const pool = await getPool();
    const have = new Set(pool.words.map((w) => w.word));
    await addPoolWords(pool._id, [...stuck.values()].filter((w) => !have.has(w.word)));
  }
}

async function updateMath(body: ParsedBody, now: Date, writes: Writes): Promise<void> {
  if (!body.mathSkill) return;
  const { MathProgress } = await db();
  const doc =
    (await MathProgress.findOne({ skill: body.mathSkill })) ??
    new MathProgress({ skill: body.mathSkill });

  doc.attempts = (doc.attempts ?? 0) + body.answered;
  doc.correct = (doc.correct ?? 0) + body.correct;
  if (body.ms > 0 && (!doc.bestMs || body.ms < doc.bestMs)) doc.bestMs = body.ms;
  // Only a round played at the stored level moves it, with the Grade 5 floor
  // and short timed runs left out; see applyRound.
  const scored = applyRound(
    { level: doc.level ?? 1, recentPcts: doc.recentPcts ?? [], lastAt: doc.lastAt },
    { answered: body.answered, correct: body.correct, timed: body.timed, playedLevel: body.mathLevel },
    todayKey(now)
  );
  doc.recentPcts = scored.recentPcts;
  doc.level = scored.level;
  doc.lastAt = now;
  writes.started = true;
  await doc.save();
}

/**
 * Claim this session id, atomically, BEFORE anything is applied.
 *
 * Returns false when the id was already claimed — a retry after a transient
 * failure, or a second window flushing the same queued session. Claiming first
 * is the point: the writes below are not transactional, so a retry that ran
 * after a half-finished apply used to advance every word's SRS schedule twice
 * and push a duplicate score into MathProgress.recentPcts.
 *
 * The `$ne` guard makes the check and the write one operation, so two requests
 * racing each other cannot both win. updateProfile() only $sets named fields,
 * so it never clobbers this list.
 *
 * The price of claiming first: if something fails after a progress write has
 * gone out, the claim stays, the retry reports xp 0, and that session's XP is
 * lost. That is the lesser harm next to advancing SRS twice. A failure before
 * any progress write gives the claim back (releaseSession), so the retry counts.
 */
async function reserveSession(sessionId: string): Promise<boolean> {
  const { Profile } = await db();
  const res = await Profile.updateOne(
    { key: PROFILE_KEY, recentSessionIds: { $ne: sessionId } },
    { $push: { recentSessionIds: { $each: [sessionId], $position: 0, $slice: RECENT_SESSION_IDS } } }
  );
  return res.modifiedCount > 0;
}

/** Undo reserveSession, for a session that failed before anything was stored. */
async function releaseSession(sessionId: string): Promise<void> {
  const { Profile } = await db();
  await Profile.updateOne({ key: PROFILE_KEY }, { $pull: { recentSessionIds: sessionId } });
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  // Played by the other child, before a switch on this phone. 409 keeps it
  // queued there until that child signs in again.
  if (body.learner && body.learner !== (await currentLearner())) {
    return NextResponse.json({ error: "other learner" }, { status: 409 });
  }

  // Played offline and sent later: it counts for the day it was played, so
  // yesterday's lesson keeps yesterday's streak day.
  const arrived = Date.now();
  const played = body.playedAt ?? arrived;
  const now = new Date(Math.min(arrived, Math.max(arrived - MAX_BACKDATE_MS, played)));
  const when = { at: now, today: todayKey(now) };

  // Also creates the profile on the very first session, which reserveSession needs.
  const before = await getProfile();

  // A retry of a session we already applied: report the current state, change
  // nothing. Must run before updateList/updateMath, not just before the rewards.
  if (body.sessionId && !(await reserveSession(body.sessionId))) {
    return NextResponse.json({
      gained: {
        xp: 0,
        newBadges: [],
        streakExtended: false,
        leveledUp: false,
        level: levelFor(before.xp).level,
        goalMet: before.today.day === when.today && before.today.lessons >= before.dailyGoal,
      },
      profile: toClientProfile(before),
    });
  }

  const result: SessionResult = body;
  const writes: Writes = { started: false };
  try {
    // Progress first, profile last: a half-written session is better than XP
    // for work the list never recorded. Only the profile step re-runs when
    // another save got in first; the list and math writes happen once.
    await updateList(body, now, writes);
    await updateMath(body, now, writes);
    const { changed, saved } = await updateProfile((current) => {
      const applied = applySession(current, result, when);
      return {
        profile: body.reading ? applyReading(applied.profile, body.reading, when) : applied.profile,
        gained: applied.gained,
      };
    });

    return NextResponse.json({
      gained: changed.gained,
      profile: toClientProfile(saved),
    });
  } catch (err) {
    if (body.sessionId && !writes.started) {
      // Best effort: if this fails too, the original error is the one to see.
      await releaseSession(body.sessionId).catch(() => undefined);
    }
    throw err;
  }
}
