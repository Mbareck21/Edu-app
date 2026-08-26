import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { todayKey } from "@/lib/day";
import { connectDB } from "@/lib/db";
import { scheduleSkill } from "@/lib/mastery";
import { MathProgress, RECENT_PCTS, nextLevel } from "@/lib/models/MathProgress";
import {
  PROFILE_KEY,
  Profile,
  RECENT_SESSION_IDS,
  toClientProfile,
} from "@/lib/models/Profile";
import { SKILL_IDS, WordList, toSkillState } from "@/lib/models/WordList";
import { getProfile, saveProfile } from "@/lib/profile";
import { applyReading, applySession, levelFor } from "@/lib/rewards";
import { STEP_IDS, stepById } from "@/lib/types";
import type { SessionResult, StepId } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({
  sessionId: z.string().min(8).max(64).optional(),
  kind: z.enum(["vocab", "math", "reading"]),
  ref: z.string().min(1).max(120),
  answered: z.number().int().min(0).max(500),
  correct: z.number().int().min(0).max(500),
  fastCount: z.number().int().min(0).max(500),
  ms: z.number().int().min(0).max(6 * 60 * 60 * 1000),
  perfect: z.boolean(),
  listId: z.string().min(1).max(64).optional(),
  step: z.enum(STEP_IDS).optional(),
  mathSkill: z.string().min(1).max(40).optional(),
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

function pctOf(body: ParsedBody): number {
  if (body.answered <= 0) return 0;
  return Math.round((body.correct / body.answered) * 100);
}

type WordResultIn = NonNullable<ParsedBody["wordResults"]>[number];

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
  now: Date
): Promise<void> {
  if (!mongoose.isValidObjectId(listId)) return;
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
  await doc.save();
}

/** Per-word, per-skill answers for one list, in one read-modify-write. */
async function applyWordResults(
  listId: string,
  results: WordResultIn[],
  now: Date
): Promise<void> {
  if (results.length === 0) return;
  if (!mongoose.isValidObjectId(listId)) return;
  const doc = await WordList.findById(listId).select("words");
  if (!doc) return;

  const byWord = new Map<string, number>();
  doc.words.forEach((w, i) => byWord.set(String(w.word).toLowerCase(), i));
  let touched = false;
  for (const r of results) {
    const index = byWord.get(r.word.toLowerCase());
    if (index === undefined) continue;
    const skill = r.skill;
    const next = scheduleSkill(
      toSkillState(doc.words[index].skills?.[skill], now),
      r.correct,
      now
    );
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
  await doc.save();
}

/** Route each word result to its list; the session's own list also gets pathProgress. */
async function updateList(body: ParsedBody, now: Date): Promise<void> {
  if (body.listId && body.step) {
    await applyPathProgress(body.listId, body.step, body, now);
  }

  const groups = new Map<string, WordResultIn[]>();
  for (const r of body.wordResults ?? []) {
    const key = r.listId ?? body.listId;
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  // One document per group, so the writes cannot collide.
  await Promise.all(
    [...groups].map(([listId, results]) => applyWordResults(listId, results, now))
  );
}

async function updateMath(body: ParsedBody, now: Date): Promise<void> {
  if (!body.mathSkill) return;
  const pct = pctOf(body);
  const doc =
    (await MathProgress.findOne({ skill: body.mathSkill })) ??
    new MathProgress({ skill: body.mathSkill });

  doc.attempts = (doc.attempts ?? 0) + body.answered;
  doc.correct = (doc.correct ?? 0) + body.correct;
  if (body.ms > 0 && (!doc.bestMs || body.ms < doc.bestMs)) doc.bestMs = body.ms;
  const prevLevel = doc.level ?? 1;
  doc.recentPcts = [pct, ...(doc.recentPcts ?? [])].slice(0, RECENT_PCTS);
  const level = nextLevel(prevLevel, doc.recentPcts);
  // Scores earned at the old level must not also justify the next promotion.
  // Without this, three good level-1 sessions promoted to 2, and then the very
  // next good session saw the same window again and jumped him straight to 3.
  if (level !== prevLevel) doc.recentPcts = [];
  doc.level = level;
  doc.lastAt = now;
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
 * racing each other cannot both win. saveProfile() only $sets named fields, so
 * it never clobbers this list.
 */
async function reserveSession(sessionId: string): Promise<boolean> {
  const res = await Profile.updateOne(
    { key: PROFILE_KEY, recentSessionIds: { $ne: sessionId } },
    { $push: { recentSessionIds: { $each: [sessionId], $position: 0, $slice: RECENT_SESSION_IDS } } }
  );
  return res.modifiedCount > 0;
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

  const now = new Date();
  const when = { at: now, today: todayKey(now) };

  await connectDB();
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
  const applied = applySession(before, result, when);
  const withReading = body.reading
    ? applyReading(applied.profile, body.reading, when)
    : applied.profile;

  // Progress first, profile last: a half-written session is better than XP
  // for work the list never recorded.
  await updateList(body, now);
  await updateMath(body, now);
  const saved = await saveProfile(withReading);

  return NextResponse.json({
    gained: applied.gained,
    profile: toClientProfile(saved),
  });
}
