import assert from "node:assert/strict";
import { test } from "node:test";

import { ECHO_PASS, compareEcho, echoTokens, echoWordMatch } from "@/lib/echo";

test("tokens drop punctuation and unify numbers", () => {
  assert.deepEqual(echoTokens("The fox ran, fast!"), ["the", "fox", "ran", "fast"]);
  assert.deepEqual(echoTokens("He had five rocks."), ["he", "had", "5", "rocks"]);
  assert.deepEqual(echoTokens("He had 5 rocks."), ["he", "had", "5", "rocks"]);
  assert.deepEqual(echoTokens("don't"), ["don't"]);
  assert.deepEqual(echoTokens("   "), []);
});

test("word match forgives a mis-heard letter but not a different word", () => {
  assert.ok(echoWordMatch("river", "rivar"));
  assert.ok(echoWordMatch("mountain", "mountian"));
  assert.ok(!echoWordMatch("cat", "cap")); // too short to spend a typo on
  assert.ok(!echoWordMatch("river", "forest"));
});

test("a clean repeat scores every word", () => {
  const s = compareEcho("The fox ran fast.", "the fox ran fast");
  assert.equal(s.matched, 4);
  assert.equal(s.total, 4);
  assert.equal(s.pct, 1);
  assert.ok(s.pass);
  assert.ok(s.great);
  assert.ok(!s.silent);
  assert.deepEqual(
    s.tokens.map((t) => t.word),
    ["The", "fox", "ran", "fast."]
  );
  assert.ok(s.tokens.every((t) => t.said));
});

test("one dropped word does not knock the rest out of line", () => {
  const s = compareEcho("The big red fox ran away.", "the big fox ran away");
  assert.equal(s.total, 6);
  assert.equal(s.matched, 5);
  assert.deepEqual(
    s.tokens.filter((t) => !t.said).map((t) => t.word),
    ["red"]
  );
  assert.ok(s.pass);
});

test("extra words he adds are ignored, not punished", () => {
  const s = compareEcho("The fox ran.", "um the the fox ran you know");
  assert.equal(s.matched, 3);
  assert.equal(s.pct, 1);
});

test("a wrong repeat fails and marks the missed words", () => {
  const s = compareEcho("The fox ran fast away.", "the dog sat");
  assert.ok(s.pct < ECHO_PASS);
  assert.ok(!s.pass);
  assert.deepEqual(
    s.tokens.filter((t) => t.said).map((t) => t.word),
    ["The"]
  );
});

test("silence is reported, never scored as a pass", () => {
  const s = compareEcho("The fox ran.", "");
  assert.ok(s.silent);
  assert.ok(!s.pass);
  assert.equal(s.matched, 0);
});

test("spoken compound numbers match the written ones", () => {
  // Every form of a number breaks into the words it is spoken as.
  assert.deepEqual(echoTokens("twenty one"), ["20", "1"]);
  assert.deepEqual(echoTokens("twenty-one"), ["20", "1"]);
  assert.deepEqual(echoTokens("21"), ["20", "1"]);
  assert.deepEqual(echoTokens("fifty six rocks"), ["50", "6", "rocks"]);
  assert.deepEqual(echoTokens("1,000 ants"), ["1", "thousand", "ants"]);
  assert.deepEqual(echoTokens("thirty"), ["30"]);
  assert.deepEqual(echoTokens("chapter one"), ["chapter", "1"]);
  const s = compareEcho("Sam has 21 rocks.", "sam has twenty one rocks");
  assert.equal(s.matched, 4);
  assert.equal(s.pct, 1);
});

test("a number written as words on screen matches Whisper's digits", () => {
  const spaced = compareEcho("Omar counted twenty five birds.", "Omar counted 25 birds.");
  assert.equal(spaced.total, 5);
  assert.equal(spaced.matched, 5);
  assert.ok(spaced.pass);
  const hyphen = compareEcho("Omar counted twenty-five birds.", "Omar counted 25 birds.");
  assert.equal(hyphen.total, 4);
  assert.equal(hyphen.matched, 4);
  const digits = compareEcho("Omar counted 25 birds.", "omar counted twenty-five birds");
  assert.equal(digits.matched, 4);
  assert.equal(compareEcho("It took 1,000 steps.", "it took one thousand steps").pct, 1);
});

test("a number is only said when all of it is said", () => {
  const s = compareEcho("Omar counted twenty-five birds.", "omar counted twenty six birds");
  assert.deepEqual(
    s.tokens.filter((t) => !t.said).map((t) => t.word),
    ["twenty-five"]
  );
  // A look-alike word is not the number.
  assert.ok(!compareEcho("five", "fire").tokens[0].said);
});

test("punctuation-only tokens are never marked wrong", () => {
  const s = compareEcho("He can't stop — really!", "he cant stop really");
  const dash = s.tokens.find((t) => t.word === "—");
  assert.ok(dash, "the dash is still shown");
  assert.equal(dash?.scored, false);
  assert.equal(s.total, 4);
  assert.equal(s.matched, 4);
  // Real words are all scored.
  assert.ok(s.tokens.filter((t) => t.word !== "—").every((t) => t.scored));
});
