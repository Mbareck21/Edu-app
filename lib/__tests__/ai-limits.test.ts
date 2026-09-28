import assert from "node:assert/strict";
import { test } from "node:test";

import { friendlyAiError, rateLimit } from "@/lib/groq";

test("one feature using up its allowance does not block the others", () => {
  // Both boys share one home IP. Echo reading transcribes every sentence, and
  // with one shared bucket a single passage locked chat and new stories for
  // an hour.
  const ip = "203.0.113.7";
  let transcribed = 0;
  while (rateLimit(ip, "transcribe").ok) transcribed++;
  assert.ok(transcribed >= 200, `only ${transcribed} transcriptions an hour`);
  const blocked = rateLimit(ip, "transcribe");
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec > 0);
  assert.equal(rateLimit(ip, "chat").ok, true);
  assert.equal(rateLimit(ip, "reading").ok, true);
  // Another house is not this one.
  assert.equal(rateLimit("198.51.100.2", "transcribe").ok, true);
});

test("each bucket keeps its own limit", () => {
  const ip = "203.0.113.8";
  let stories = 0;
  while (rateLimit(ip, "reading").ok) stories++;
  assert.ok(stories >= 10 && stories < 60, `${stories} stories an hour`);
  assert.equal(rateLimit(ip, "clues").ok, true);
});

const status = (message: string, s: number) => Object.assign(new Error(message), { status: s });

test("a per-minute rate limit says a minute, not tomorrow", () => {
  const tpm =
    "Rate limit reached for model `openai/gpt-oss-120b` in organization `org_x` service tier " +
    "`on_demand` on tokens per minute (TPM): Limit 8000, Used 6100, Requested 2900. Please try again in 5.2s.";
  const shown = friendlyAiError(status(tpm, 429), "fb");
  assert.match(shown, /minute/i);
  assert.doesNotMatch(shown, /tomorrow/i);
  assert.ok(!shown.includes("org_"));
});

test("a per-day rate limit still says tomorrow", () => {
  const tpd =
    "Rate limit reached for model `openai/gpt-oss-120b` in organization `org_x` service tier " +
    "`on_demand` on tokens per day (TPD): Limit 200000, Used 198659, Requested 5666. Please try again in 31m8s.";
  assert.match(friendlyAiError(status(tpd, 429), "fb"), /tomorrow/i);
  assert.match(friendlyAiError(new Error(tpd), "fb"), /tomorrow/i);
});
