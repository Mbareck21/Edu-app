import assert from "node:assert/strict";
import test from "node:test";

import { mulberry32 } from "@/lib/math/rng";
import { FALL_START_MS, blanksFor, letterChoices, nextFallMs, rescuable } from "@/lib/rescue";

test("short words get one gap, long words two, never the first letter or side by side", () => {
  for (let seed = 1; seed < 200; seed++) {
    const rng = mulberry32(seed);
    const short = blanksFor("frog", rng);
    assert.equal(short.length, 1);
    assert.ok(short[0] > 0);
    const long = blanksFor("adaptation", rng);
    assert.equal(long.length, 2);
    assert.ok(long.every((i) => i > 0));
    assert.ok(long[1] - long[0] >= 2);
  }
});

test("gaps only land on letters, never on a space", () => {
  for (let seed = 1; seed < 100; seed++) {
    const word = "rock layer";
    for (const i of blanksFor(word, mulberry32(seed))) assert.match(word[i], /[a-z]/);
  }
});

test("four different choices, one of them right", () => {
  for (let seed = 1; seed < 200; seed++) {
    for (const answer of ["b", "e", "q", "x", "m"]) {
      const choices = letterChoices(answer, mulberry32(seed));
      assert.equal(choices.length, 4);
      assert.equal(new Set(choices).size, 4);
      assert.ok(choices.includes(answer));
    }
  }
});

test("the fall speeds up while he wins and eases off after a splash, within limits", () => {
  let ms = FALL_START_MS;
  for (let i = 0; i < 30; i++) ms = nextFallMs(ms, true);
  assert.equal(ms, 9_000);
  assert.equal(nextFallMs(9_000, false), 11_500);
  let slow = FALL_START_MS;
  for (let i = 0; i < 10; i++) slow = nextFallMs(slow, false);
  assert.equal(slow, 20_000);
});

test("only words with three letters or more are used", () => {
  assert.equal(rescuable("ox"), false);
  assert.equal(rescuable("fox"), true);
  assert.equal(rescuable("a b"), false);
});
