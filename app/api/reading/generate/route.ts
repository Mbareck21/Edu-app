import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { todayKey } from "@/lib/day";
import { WordList, toClient, READING_QUESTION_TYPES } from "@/lib/models/WordList";
import { getProfile } from "@/lib/profile";
import {
  scienceUnitForWeek,
  themeForWeek,
  type ReadingTheme,
  type ScienceUnit,
} from "@/lib/curriculum";
import {
  MAX_GLOSSARY_ENTRIES,
  clampLevel,
  countWords,
  longestSentenceWords,
  questionPlan,
  readingParams,
  type PassageKind,
  type QuestionSpec,
} from "@/lib/reading";
import {
  groq,
  CLUE_MODEL,
  READING_SYSTEM_PROMPT,
  rateLimit,
  getClientIp,
} from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;

// `listId` is the only required field — the concurrent Read-step runner posts
// exactly that. Everything else is an optional override.
const Body = z.object({
  listId: z.string().min(1),
  level: z.number().int().min(1).max(10).optional(),
  kind: z.enum(["story", "info"]).optional(),
});

const QuestionShape = z.object({
  q: z.string().min(3).max(220),
  type: z.enum(READING_QUESTION_TYPES),
  format: z.enum(["text", "mcq"]).default("text"),
  acceptable: z.array(z.string().min(1).max(300)).min(1).max(8),
  options: z.array(z.string().min(1).max(300)).max(5).default([]),
  answerIndex: z.number().int().min(-1).max(4).default(-1),
  hints: z.array(z.string().min(1).max(220)).min(1).max(3),
  source: z.string().max(400).default(""),
});

const ResponseShape = z.object({
  title: z.string().min(2).max(70),
  paragraphs: z.array(z.string().min(20).max(1200)).min(1).max(6),
  usedWords: z.array(z.string()).default([]),
  glossary: z
    .array(
      z.object({
        word: z.string().min(1).max(40),
        meaning: z.string().max(160).default(""),
        arabic: z.string().max(80).default(""),
      })
    )
    .max(MAX_GLOSSARY_ENTRIES)
    .default([]),
  questions: z.array(QuestionShape).min(2).max(10),
});

const MAX_STUDY_WORDS = 12;
const MAX_HISTORY_ENTRIES = 5;

type HistoryEntry = {
  title: string;
  opening: string;
  kind?: string;
  topic?: string;
  generatedAt: Date;
};

function sample<T>(items: readonly T[], n: number): T[] {
  if (items.length <= n) return [...items];
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/**
 * Shuffle the options and report where the right one landed. Models park the
 * correct answer at index 0 far too often; this kills the position tell.
 */
function shuffleOptions(options: string[], answerIndex: number): {
  options: string[];
  answerIndex: number;
} {
  const answer = options[answerIndex];
  const shuffled = sample(options, options.length);
  return { options: shuffled, answerIndex: Math.max(0, shuffled.indexOf(answer)) };
}

/** Story and informational passages alternate so both standards get worked. */
function nextKind(history: HistoryEntry[]): PassageKind {
  const last = history[history.length - 1];
  return last?.kind === "story" ? "info" : "story";
}

function describePlan(plan: QuestionSpec[]): string {
  return plan
    .map((spec, i) => {
      const fmt =
        spec.format === "mcq"
          ? `mcq with exactly ${spec.options} options`
          : "text (he types the answer)";
      return `${i + 1}. type "${spec.type}", format ${fmt} — ${spec.brief}`;
    })
    .join("\n");
}

type Gloss = { word: string; meaning: string; arabic: string };

/** One card per word — models sometimes gloss the same word twice. */
function dedupeGlosses(raw: { word: string; meaning: string; arabic: string }[]): Gloss[] {
  const seen = new Map<string, Gloss>();
  for (const g of raw) {
    const word = g.word.trim().toLowerCase();
    if (!word || seen.has(word)) continue;
    seen.set(word, { word, meaning: g.meaning.trim(), arabic: g.arabic.trim() });
  }
  return [...seen.values()];
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!mongoose.isValidObjectId(parsed.data.listId)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  await connectDB();
  const doc = await WordList.findById(parsed.data.listId);
  if (!doc) return NextResponse.json({ error: "list not found" }, { status: 404 });

  const allWords = (doc.words || [])
    .map((w) => String(w.word))
    .filter((w) => /^[a-z][a-z\s-]*$/.test(w));

  // The reading ladder lives on the profile, not the list. An explicit level
  // in the body wins (the drill / practice screens may want to pin one).
  const profile = await getProfile();
  const level = clampLevel(parsed.data.level ?? profile.reading.level ?? 1);
  const params = readingParams(level);

  const history = ((doc.get("readingHistory") as HistoryEntry[] | undefined) ?? []).slice(
    -MAX_HISTORY_ENTRIES
  );
  const kind: PassageKind = parsed.data.kind ?? nextKind(history);

  // What the class is doing this week. Informational passages ride the science
  // unit when there is one; stories ride the Benchmark reading theme.
  const todayISO = todayKey();
  const theme: ReadingTheme = themeForWeek(todayISO);
  const scienceUnit: ScienceUnit | null = scienceUnitForWeek(todayISO);
  const useScience = kind === "info" && scienceUnit !== null;

  const topic = useScience && scienceUnit ? scienceUnit.title : theme.title;
  const topicWords = sample(
    useScience && scienceUnit ? scienceUnit.words : theme.words,
    5
  );
  const topicIdea =
    useScience && scienceUnit
      ? sample(scienceUnit.passageIdeas, 1)[0]
      : sample(theme.prompts.slice(1), 1)[0];
  const essentialQuestion = theme.prompts[0];

  const studyWords = sample(allWords, MAX_STUDY_WORDS);
  const plan = questionPlan(level, kind, useScience);

  const historyBlock =
    history.length > 0
      ? `\n\nRECENT PASSAGES on this list (make this one genuinely different):\n` +
        history
          .map((h, i) => `${i + 1}. "${h.title}" (${h.kind ?? "story"}) — opens: ${h.opening}`)
          .join("\n")
      : "";

  const kindBlock =
    kind === "info"
      ? `KIND: info (informational, non-fiction)
TOPIC: ${topic}${useScience && scienceUnit ? ` — this is the science unit his class is on now (${scienceUnit.standards.map((s) => s.code).join(", ") || "no code"})` : ""}
ANGLE: ${topicIdea ?? topic}
The writer must make one clear point and back it with reasons and examples.`
      : `KIND: story (narrative)
TOPIC: ${topic} — the reading unit his class is on now
BIG QUESTION the class is asking: ${essentialQuestion}
ANGLE: ${topicIdea ?? essentialQuestion}
The story must carry a lesson he could name in one sentence.`;

  const userPrompt = `LEVEL: ${level} of 10
TARGET WORDS: ${params.targetWords} (never fewer than ${params.minWords}, never more than ${params.maxWords})
MAX SENTENCE WORDS: ${params.maxSentenceWords}
PARAGRAPHS: ${params.paragraphs}
UNKNOWN-WORD BUDGET: ${params.unknownBudget} (every one goes in "glossary")

${kindBlock}

TOPIC WORDS (use 3-5 of them): ${topicWords.join(", ")}
STUDY WORDS he has been learning (prefer these, use as many as fit naturally): ${studyWords.join(", ") || "none yet"}

QUESTION PLAN — produce exactly these ${plan.length} questions, in this order:
${describePlan(plan)}${historyBlock}

Write the passage and the questions now. Strict JSON only.`;

  // Generate, and retry once when the passage misses the level targets.
  let reading: z.infer<typeof ResponseShape> | null = null;
  let lastErr: string | null = null;
  let correction = "";

  for (let attempt = 1; attempt <= 2 && !reading; attempt++) {
    try {
      const completion = await groq().chat.completions.create({
        model: CLUE_MODEL,
        messages: [
          { role: "system", content: READING_SYSTEM_PROMPT },
          { role: "user", content: userPrompt + correction },
        ],
        response_format: { type: "json_object" },
        temperature: 0.75,
        max_tokens: 5000,
      reasoning_effort: "low",
      });
      const text = completion.choices[0]?.message?.content ?? "{}";
      const validated = ResponseShape.safeParse(JSON.parse(text));
      if (!validated.success) {
        lastErr = "AI returned a malformed reading";
        correction = `\n\nYour last answer did not match the JSON shape. Return every field exactly as the shape shows, and exactly ${plan.length} questions.`;
        continue;
      }

      const passage = validated.data.paragraphs.join("\n\n");
      const words = countWords(passage);
      const longest = longestSentenceWords(passage);
      const short = words < params.minWords;
      const rambling = longest > params.maxSentenceWords + 3;
      const wrongCount = validated.data.questions.length !== plan.length;

      if (attempt === 1 && (short || rambling || wrongCount)) {
        const fixes: string[] = ["\n\nYour previous attempt fell short. Fix this:"];
        if (short) {
          fixes.push(
            `- The passage was ${words} words. It must be at least ${params.minWords}. Add another beat to the passage — do not pad with repeated sentences.`
          );
        }
        if (rambling) {
          fixes.push(
            `- One sentence ran to ${longest} words. No sentence may pass ${params.maxSentenceWords} words. Split the long ones.`
          );
        }
        if (wrongCount) {
          fixes.push(
            `- You returned ${validated.data.questions.length} questions. The plan asks for exactly ${plan.length}, in the given order and types.`
          );
        }
        correction = fixes.join("\n");
        continue;
      }
      reading = validated.data;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "unknown error";
    }
  }

  if (!reading) {
    return NextResponse.json(
      { error: lastErr || "could not generate reading" },
      { status: 502 }
    );
  }

  const passage = reading.paragraphs.map((p) => p.trim()).join("\n\n");

  // Normalise the questions: MCQs must have a usable answerIndex, free-text
  // must not carry stray options, and every question keeps exactly 2 hints.
  const questions = reading.questions.map((q, i) => {
    const spec = plan[i];
    const wantsMcq = (spec?.format ?? q.format) === "mcq";
    const options = wantsMcq ? q.options.filter((o) => o.trim()) : [];
    let answerIndex = wantsMcq ? q.answerIndex : -1;
    if (wantsMcq && (answerIndex < 0 || answerIndex >= options.length)) {
      // Fall back to matching the model's own "acceptable" text.
      const guess = options.findIndex(
        (o) => o.trim().toLowerCase() === (q.acceptable[0] ?? "").trim().toLowerCase()
      );
      answerIndex = guess >= 0 ? guess : 0;
    }
    const hints = q.hints.slice(0, 2);
    while (hints.length < 2) hints.push("Read it again and look for the answer.");
    const shuffled =
      wantsMcq && options.length > 1
        ? shuffleOptions(options, answerIndex)
        : { options, answerIndex };
    return {
      q: q.q,
      type: spec?.type ?? q.type,
      acceptable: wantsMcq
        ? [shuffled.options[shuffled.answerIndex] ?? q.acceptable[0]]
        : q.acceptable,
      hints,
      options: shuffled.options,
      answerIndex: wantsMcq ? shuffled.answerIndex : -1,
      // Only keep a source sentence that really is in the passage.
      source: q.source && passage.includes(q.source.trim()) ? q.source.trim() : "",
    };
  });

  const now = new Date();
  doc.set("currentReading", {
    title: reading.title,
    paragraph: passage,
    questions,
    vocabGlosses: dedupeGlosses(reading.glossary),
    level,
    passageKind: kind,
    topic,
    generatedAt: now,
  });
  // Keep the list's own level mirroring the level actually used, so the Words
  // tab and the old reading page still show something true.
  doc.set("readingLevel", level);

  const opening =
    passage.split(/(?<=[.!?])\s+/)[0]?.slice(0, 160) ?? passage.slice(0, 160);
  const newHistory: HistoryEntry[] = [
    ...((doc.get("readingHistory") as HistoryEntry[] | undefined) ?? []),
    { title: reading.title, opening, kind, topic, generatedAt: now },
  ].slice(-MAX_HISTORY_ENTRIES);
  doc.set("readingHistory", newHistory);

  await doc.save();

  const fresh = await WordList.findById(parsed.data.listId).lean();
  if (!fresh) {
    return NextResponse.json({ error: "list disappeared" }, { status: 500 });
  }
  return NextResponse.json(toClient(fresh));
}
