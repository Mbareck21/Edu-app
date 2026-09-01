import assert from "node:assert/strict";
import { test } from "node:test";

import fs from "node:fs";
import path from "node:path";

import { friendlyAiError } from "@/lib/groq";

/**
 * On 2026-08-31 the free tier's daily token budget ran out mid-session and the
 * app put the upstream JSON on screen — organisation id, byte counts and a
 * link to a billing page — in front of a nine-year-old. These tests exist so
 * that cannot come back.
 */

const REAL_429 =
  'Rate limit reached for model `openai/gpt-oss-120b` in organization ' +
  '`org_01jsam4nmzfxxaa332jzg3nvbq` service tier `on_demand` on tokens per day ' +
  '(TPD): Limit 200000, Used 198659, Requested 5666. Please try again in ' +
  '31m8.399999999s. Need more tokens? Upgrade to Dev Tier today at ' +
  'https://console.groq.com/settings/billing';

function withStatus(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

test("a rate limit never shows the child the upstream text", () => {
  const shown = friendlyAiError(withStatus(REAL_429, 429), "fallback");
  assert.ok(!shown.includes("org_"), "leaked the organisation id");
  assert.ok(!shown.includes("http"), "leaked a link");
  assert.ok(!/\d{5,}/.test(shown), "leaked raw token counts");
  assert.ok(shown.length < 140, "too long to read");
  // And it tells him the truth: waiting, not retrying, is what helps.
  assert.match(shown, /tomorrow/i);
});

test("a rate limit is recognised without a status code", () => {
  // The sdk does not always attach one; the message alone has to be enough.
  const shown = friendlyAiError(new Error(REAL_429), "fallback");
  assert.match(shown, /tomorrow/i);
});

test("a slow or broken server invites another tap", () => {
  assert.match(friendlyAiError(withStatus("upstream boom", 503), "fb"), /again/i);
  assert.match(friendlyAiError(new Error("fetch failed"), "fb"), /again/i);
});

test("a bad key asks for a grown-up, not another tap", () => {
  const shown = friendlyAiError(withStatus("invalid api key", 401), "fb");
  assert.match(shown, /grown-up/i);
  assert.ok(!shown.toLowerCase().includes("api key"));
});

test("anything unrecognised falls back to the caller's wording", () => {
  assert.equal(friendlyAiError(new Error("something odd"), "fb"), "fb");
  assert.equal(friendlyAiError(null, "fb"), "fb");
});

test("every AI route runs its failures through the mapper", () => {
  // A guard, not a style rule. Seven routes hand upstream text to the screen;
  // the reading one was fixed first and the other six leaked identically. If a
  // new route reintroduces `err.message`, this fails instead of shipping.
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : full.endsWith(".ts") ? [full] : [];
    });

  const offenders = walk(path.join(process.cwd(), "app", "api")).filter((file) => {
    const src = fs.readFileSync(file, "utf8");
    // Only routes that return the caught error to the client.
    return /catch\s*\(\s*err/.test(src) && /err instanceof Error \? err\.message/.test(src);
  });

  assert.deepEqual(
    offenders.map((f) => path.relative(process.cwd(), f)),
    [],
    "these routes return raw upstream text to the child"
  );
});
