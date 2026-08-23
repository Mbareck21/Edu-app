import assert from "node:assert/strict";
import { test } from "node:test";

import { mulberry32 } from "@/lib/math/rng";
import { ORDER_JITTER, orderByNeed } from "@/lib/practice-order";

type W = { id: string; due: boolean; streak: number };
const need = (w: W) => ({ due: w.due, streak: w.streak });
const ids = (ws: W[]) => ws.map((w) => w.id).join("");

test("a due word always beats one that is not, however strong", () => {
  const words: W[] = [
    { id: "strong-due", due: true, streak: 9 },
    { id: "weak-later", due: false, streak: 0 },
  ];
  for (let seed = 1; seed <= 30; seed++) {
    assert.equal(orderByNeed(words, mulberry32(seed), need)[0].id, "strong-due");
  }
});

test("the noise never lets a much stronger word jump the weakest", () => {
  const words: W[] = [
    { id: "s3", due: true, streak: 3 },
    { id: "s0", due: true, streak: 0 },
  ];
  // 3 is more than ORDER_JITTER apart, so the ranges cannot overlap.
  assert.ok(3 > ORDER_JITTER);
  for (let seed = 1; seed <= 30; seed++) {
    assert.equal(orderByNeed(words, mulberry32(seed), need)[0].id, "s0");
  }
});

test("words of equal need come out in a different order on a different seed", () => {
  const words: W[] = "abcdefgh".split("").map((id) => ({ id, due: true, streak: 0 }));
  const seen = new Set<string>();
  for (let seed = 1; seed <= 20; seed++) seen.add(ids(orderByNeed(words, mulberry32(seed), need)));
  // This is the whole point: "Again" used to be one fixed order forever.
  assert.ok(seen.size > 10, `expected many orders, got ${seen.size}`);
});

test("the same seed still gives the same order", () => {
  const words: W[] = "abcdefgh".split("").map((id) => ({ id, due: true, streak: 0 }));
  assert.equal(
    ids(orderByNeed(words, mulberry32(7), need)),
    ids(orderByNeed(words, mulberry32(7), need))
  );
});

test("neighbouring streaks do trade places, so the weak pile is not fixed", () => {
  const words: W[] = [
    { id: "a", due: true, streak: 0 },
    { id: "b", due: true, streak: 1 },
  ];
  const orders = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) orders.add(ids(orderByNeed(words, mulberry32(seed), need)));
  assert.equal(orders.size, 2, "streak 0 and streak 1 should both lead sometimes");
});
