import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { todayKey } from "@/lib/day";
import { connectDB } from "@/lib/db";
import { scheduleSkill } from "@/lib/mastery";
import { MathProgress, RECENT_PCTS, nextLevel } from "@/lib/models/MathProgress";
import { toClientProfile } from "@/lib/models/Profile";
import { SKILL_IDS, WordList } from "@/lib/models/WordList";
import { getProfile, saveProfile } from "@/lib/profile";
import { applyReading, applySession } from "@/lib/rewards";
import { STEP_IDS } from "@/lib/types";
import type { SessionResult, SkillStateLike } from "@/lib/types";

export const runtime = "nodejs";

/** A step counts as done at 60%, or just for showing up on read-only steps. */
const PASS_PCT = 60;
const ALWAYS_COMPLETE: readonly string[] = ["flashcards", "read"];

const Body = z.object({
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

/** pathProgress + per-word skills, in one read-modify-write on the list. */
async function updateList(body: ParsedBody, now: Date): Promise<void> {
  if (!body.listId || !mongoose.isValidObjectId(body.listId)) return;
  const doc = await WordList.findById(body.listId);
  if (!doc) return;

  if (body.step) {
    const pct = pctOf(body);
    const prev = doc.pathProgress?.get(body.step);
    const completed =
      pct >= PASS_PCT || ALWAYS_COMPLETE.includes(body.step)
        ? now
        : (prev?.completedAt ?? null);
    doc.pathProgress?.set(body.step, {
      completedAt: completed,
      bestPct: Math.max(Number(prev?.bestPct) || 0, pct),
      plays: (Number(prev?.plays) || 0) + 1,
    });
    doc.markModified("pathProgress");
  }

  if (body.wordResults?.length) {
    const byWord = new Map<string, number>();
    doc.words.forEach((w, i) => byWord.set(String(w.word).toLowerCase(), i));
    let touched = false;
    for (const r of body.wordResults) {
      const index = byWord.get(r.word.toLowerCase());
      if (index === undefined) continue;
      const word = doc.words[index];
      const skill = r.skill;
      const current: SkillStateLike = word.skills?.[skill] ?? {};
      const next = scheduleSkill(
        {
          correct: Number(current.correct) || 0,
          wrong: Number(current.wrong) || 0,
          streak: Number(current.streak) || 0,
          lastAt: current.lastAt ? new Date(current.lastAt).toISOString() : null,
          dueAt: current.dueAt ? new Date(current.dueAt).toISOString() : now.toISOString(),
        },
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
    if (touched) doc.markModified("words");
  }

  await doc.save();
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
  doc.recentPcts = [pct, ...(doc.recentPcts ?? [])].slice(0, RECENT_PCTS);
  doc.level = nextLevel(doc.level ?? 1, doc.recentPcts);
  doc.lastAt = now;
  await doc.save();
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
