import Groq from "groq-sdk";

let _client: Groq | null = null;
export function groq(): Groq {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.startsWith("gsk_xxx")) {
      throw new Error("GROQ_API_KEY is not set. Get a free key at https://console.groq.com/keys");
    }
    _client = new Groq({ apiKey });
  }
  return _client;
}

// Models — pinned so behavior is predictable. All free on Groq's hobby tier.
export const CHAT_MODEL = "llama-3.1-8b-instant";   // fast, friendly, plenty smart for a 9-year-old
export const CLUE_MODEL = "llama-3.3-70b-versatile"; // a touch slower but writes nicer simple-English clues
export const STT_MODEL = "whisper-large-v3-turbo";   // fast multilingual speech recognition

// ────────────────────────────────────────────────────────────────────────────
// ✏️ PARENT CONTRIBUTION #3 — Voice selection for AI speech
// ────────────────────────────────────────────────────────────────────────────
// These are Microsoft Edge TTS neural voice IDs. Listen to samples and pick
// the ones your family likes most, then redeploy.
//
// English voices (try in order):
//   "en-US-AnaNeural"     — CHILD voice, peer-style, friendly (default)
//   "en-GB-MaisieNeural"  — UK child voice
//   "en-US-AriaNeural"    — warm female adult, natural
//   "en-US-JennyNeural"   — clear female adult, education-style
//   "en-US-GuyNeural"     — warm male adult
//
// Arabic voices (try in order):
//   "ar-EG-SalmaNeural"   — Egyptian female (most widely understood, default)
//   "ar-EG-ShakirNeural"  — Egyptian male
//   "ar-SA-ZariyahNeural" — Saudi MSA female (formal)
//   "ar-SA-HamedNeural"   — Saudi MSA male
// ────────────────────────────────────────────────────────────────────────────
export const AI_ENGLISH_VOICE = "en-US-AnaNeural";
export const AI_ARABIC_VOICE = "ar-EG-SalmaNeural";

// ────────────────────────────────────────────────────────────────────────────
// ✏️ PARENT CONTRIBUTION #1 — Tutor personality
// ────────────────────────────────────────────────────────────────────────────
// This is the AI's "personality" when your son chats with it on /chat.
// Edit the string below to make it feel like *your* family's tutor.
//
// Ideas to think about:
//   • Does it call him by name? ("Hi Adam!") Or stay neutral?
//   • Should it ask him questions back, or just answer his?
//   • Topics to encourage (sports he loves, animals he's curious about)?
//   • Anything to avoid beyond the safety basics?
//   • Should it occasionally quiz him on his current word list?
//
// Keep it under ~10 lines so the AI follows it reliably.
// ────────────────────────────────────────────────────────────────────────────
export const CHAT_SYSTEM_PROMPT = `
You are a friendly English tutor for a 9-year-old boy whose first language is Arabic.
He is preparing for 4th grade — focus on VOCABULARY and READING COMPREHENSION.

This chat is SPOKEN aloud through text-to-speech. Write accordingly:
- Use SIMPLE English. Short sentences (under 12 words when possible).
- Use Grade 3-4 vocabulary. Plain pronounceable words.
- Never use markdown, asterisks, bullets, dashes-as-bullets, or emojis — they sound bad spoken.
- Be warm and encouraging. Praise effort, not just correct answers.
- When he speaks with a grammar mistake, gently say it the correct way, then continue.

Arabic policy (your most important rule):
- When you introduce a vocabulary word he probably does NOT know, follow the English word
  with the Arabic translation in parentheses on first use. Example:
    "A curious (فضولي) person wants to know more about things."
- Do NOT repeat the Arabic if the word has appeared earlier in this conversation.
- If he sounds confused after your reply, you may briefly clarify the key concept in
  Arabic (one short sentence), then continue in English.
- If he speaks Arabic to you, answer his actual question in simple English, and gently
  invite him to try saying it in English next time.
- Keep Arabic short — a single word in parens, or at most one short sentence. The point
  is to keep him in English with Arabic as a safety net, not the other way around.

Safety:
- Never discuss violence, scary content, weapons, drugs, dating, or adult topics.
- If he asks something unsafe, kindly steer back to fun topics — animals, sports,
  cartoons, school, family.

Stay short: 1-3 short sentences per reply unless he asks for more.
`.trim();

// ────────────────────────────────────────────────────────────────────────────
// ✏️ PARENT CONTRIBUTION #2 — Clue-writing style
// ────────────────────────────────────────────────────────────────────────────
// When you click "AI suggest clues" on a word list, this prompt drives the
// style of clue produced for each word.
//
// Pick ONE style (or mix) that you think will help your son most:
//   • Definition:           "An animal that says meow"   → CAT
//   • Behavioral / scenario:"Something happens you didn't expect" → SURPRISED
//   • Fill-the-blank:       "The ___ is shining today"   → SUN
//   • Synonym:              "Another word for happy"     → GLAD
//
// The default below is a "kid-friendly mini-definition" — short, concrete,
// uses words he probably already knows.
// ────────────────────────────────────────────────────────────────────────────
export const CLUE_SYSTEM_PROMPT = `
You write CROSSWORD CLUES for a 9-year-old learning English.

Rules for each clue:
- 4–12 words long. Short and concrete.
- Use only common Grade 3 vocabulary (think: animal, food, color, family, school).
- NEVER include the answer word itself, any form of it (plural, tense), or its first letter as a hint.
- Prefer a simple definition or a "something that…" pattern. Example: cat → "An animal that says meow and likes milk".
- For abstract words (feelings, actions), describe a situation. Example: surprised → "How you feel when something happens you did not expect".

Return STRICT JSON in this exact shape:
{"clues": {"word1": "clue text", "word2": "clue text", ...}}
Keys must match the input words exactly (lowercase). No extra text outside the JSON.
`.trim();

// ────────────────────────────────────────────────────────────────────────────
// Simple in-memory rate limiter — 30 messages / hour per IP.
// Good enough for one family. Resets when the Node process restarts.
// ────────────────────────────────────────────────────────────────────────────
const HITS = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 30;

export function rateLimit(ip: string): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const recent = (HITS.get(ip) || []).filter((t) => t > cutoff);
  if (recent.length >= LIMIT) {
    const retryAfterSec = Math.ceil((recent[0] + WINDOW_MS - now) / 1000);
    HITS.set(ip, recent);
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  HITS.set(ip, recent);
  return { ok: true, retryAfterSec: 0 };
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
