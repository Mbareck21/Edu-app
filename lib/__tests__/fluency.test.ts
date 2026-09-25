import assert from "node:assert/strict";
import test from "node:test";

import { fluencyHeadline, fluencyPart, scoreFluency } from "@/lib/fluency";

const words = (n: number, w = "word") => Array.from({ length: n }, () => w).join(" ");

test("the part is the first paragraph, topped up while it is short", () => {
  const long = `${words(50, "alpha")}\n\n${words(30, "beta")}`;
  assert.equal(fluencyPart(long), words(50, "alpha"));
  const short = `${words(20, "alpha")}\n\n${words(30, "beta")}\n\n${words(30, "gamma")}`;
  assert.equal(fluencyPart(short), `${words(20, "alpha")}\n\n${words(30, "beta")}`);
  // Never grows past the cap to reach the minimum.
  const capped = `${words(20, "alpha")}\n\n${words(110, "beta")}`;
  assert.equal(fluencyPart(capped), words(20, "alpha"));
});

test("words correct per minute counts only the words read right", () => {
  const part = "The fox ran across the green field to find her little cubs.";
  // 12 words, all read, in 12 seconds → 60 a minute.
  const all = scoreFluency(part, "the fox ran across the green field to find her little cubs", 12_000);
  assert.equal(all.correct, 12);
  assert.equal(all.wcpm, 60);
  assert.equal(all.heardEnough, true);
  assert.deepEqual(all.tricky, []);

  const some = scoreFluency(part, "the fox ran across the field to find her cubs", 12_000);
  assert.equal(some.correct, 10);
  assert.equal(some.wcpm, 50);
  assert.deepEqual(some.tricky, ["green", "little"]);
});

test("words after where he stopped are not reached, not wrong", () => {
  const part = "The fox ran across the green field to find her little cubs.";
  const r = scoreFluency(part, "the fox ran across the green field", 10_000);
  assert.equal(r.correct, 7);
  assert.equal(r.total, 7);
  assert.equal(r.accuracy, 1);
  assert.deepEqual(r.tricky, []);
});

test("a read the mic barely caught is not scored", () => {
  const part = "The fox ran across the green field to find her little cubs.";
  assert.equal(scoreFluency(part, "", 20_000).heardEnough, false);
  assert.equal(scoreFluency(part, "fox", 20_000).wcpm, 0);
  assert.equal(scoreFluency(part, "the fox ran across the green field", 3_000).heardEnough, false);
});

test("tricky words skip tiny words and repeats, and stop at five", () => {
  const part = "Whales and dolphins and sharks and octopus and seahorses and jellyfish swim.";
  const r = scoreFluency(part, "swim", 20_000);
  assert.ok(r.tricky.length <= 5);
  assert.ok(!r.tricky.includes("and"));
});

test("the headline is about his own record", () => {
  assert.equal(fluencyHeadline(50, null), "first");
  assert.equal(fluencyHeadline(61, 60), "record");
  assert.equal(fluencyHeadline(55, 60), "close");
  assert.equal(fluencyHeadline(40, 60), "good");
});
