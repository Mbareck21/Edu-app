// A reading must arrive (2026-11-15 sweep): a new list falls back on another
// list's archive, a multiple choice that lost its key is dropped rather than
// typed, and a per-minute rate limit is waited out when the wait fits.

import assert from "node:assert/strict";
import test from "node:test";

import { rateLimitWaitMs } from "@/lib/groq";
import { REUSE_AFTER_MS, keyedMcq, pickFallback } from "@/lib/reading";

// ── A multiple choice keeps its key or is not served ──────────────────────

test("a sound multiple choice keeps its options and key", () => {
  assert.deepEqual(keyedMcq(["a nest", "a cave", "a den", "a hive"], 2, ["a den"]), {
    options: ["a nest", "a cave", "a den", "a hive"],
    answerIndex: 2,
  });
});

test("an answer index out of range is recovered from the writer's own answer", () => {
  assert.equal(keyedMcq(["a nest", "a cave", "a den"], -1, ["A den"])?.answerIndex, 2);
  assert.equal(keyedMcq(["a nest", "a cave", "a den"], 7, ["a cave"])?.answerIndex, 1);
});

test("a multiple choice with no sure key is null, not a typed question", () => {
  // No index and the answer text matches no option.
  assert.equal(keyedMcq(["a nest", "a cave", "a den"], -1, ["the burrow"]), null);
  // A distractor that is also an accepted answer: two right options.
  assert.equal(keyedMcq(["kind", "brave", "shy"], 0, ["kind", "brave"]), null);
  // The same option twice is one option, and with nothing else to pick, no choice.
  assert.equal(keyedMcq(["patient", "Patient."], 0, ["patient"]), null);
  // The writer sent no options at all.
  assert.equal(keyedMcq([], 0, ["a den"]), null);
});

// ── The fallback when the writer cannot be reached ────────────────────────

const NOW = Date.parse("2026-11-16T00:00:00Z");
const old = (days: number, questions: number, title = `p${days}`) => ({
  title,
  generatedAt: new Date(NOW - days * 86_400_000),
  questions,
});
const servable = (a: { questions: number }) => a.questions;

test("a list with no archive falls back on another list's", () => {
  const pick = pickFallback([], [[old(9, 4)], [old(20, 5)]], NOW, servable);
  assert.equal(pick?.passage.title, "p20");
  assert.equal(pick?.from, 1);
});

test("the list's own archive comes first", () => {
  const pick = pickFallback([old(8, 4)], [[old(30, 5)]], NOW, servable);
  assert.equal(pick?.passage.title, "p8");
  assert.equal(pick?.from, -1);
});

test("a full passage from another list beats a thin one of his own", () => {
  const pick = pickFallback([old(8, 2)], [[old(10, 4)]], NOW, servable);
  assert.equal(pick?.passage.title, "p10");
  assert.equal(pick?.from, 0);
  // With nothing full anywhere, a thin one still beats an error.
  assert.equal(pickFallback([old(8, 2)], [[old(10, 1)]], NOW, servable)?.from, -1);
});

test("nothing is served again inside a week, and nothing with no questions", () => {
  assert.ok(REUSE_AFTER_MS >= 7 * 86_400_000);
  assert.equal(pickFallback([old(3, 5)], [[old(6, 5)]], NOW, servable), null);
  assert.equal(pickFallback([old(9, 0)], [[old(12, 0)]], NOW, servable), null);
  assert.equal(pickFallback([], [], NOW, servable), null);
});

// ── A per-minute rate limit is waited out ─────────────────────────────────

const status = (message: string, s: number, headers?: Headers) =>
  Object.assign(new Error(message), { status: s, headers });

const TPM =
  "Rate limit reached for model `openai/gpt-oss-120b` in organization `org_x` service tier " +
  "`on_demand` on tokens per minute (TPM): Limit 8000, Used 6100, Requested 2900. Please try again in 5.2s.";

test("a per-minute limit says how long to wait", () => {
  assert.equal(rateLimitWaitMs(status(TPM, 429)), 5200);
  assert.equal(rateLimitWaitMs(status(TPM.replace("5.2s", "1m2.5s"), 429)), 62_500);
  assert.equal(rateLimitWaitMs(status(TPM.replace("5.2s", "850ms"), 429)), 850);
  // No time in the text: the header says.
  assert.equal(rateLimitWaitMs(status("Rate limit reached", 429, new Headers({ "retry-after": "12" }))), 12_000);
});

test("the daily budget and other failures are not waited out", () => {
  const tpd = TPM.replace("tokens per minute (TPM)", "tokens per day (TPD)").replace("5.2s", "31m8s");
  assert.equal(rateLimitWaitMs(status(tpd, 429)), null);
  assert.equal(rateLimitWaitMs(status("Internal error. Please try again in 5s.", 500)), null);
  assert.equal(rateLimitWaitMs(status("Rate limit reached", 429)), null);
  assert.equal(rateLimitWaitMs(new Error("fetch failed")), null);
});
