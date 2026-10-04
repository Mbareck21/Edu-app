// What a child may open (lib/assigned.ts): the quest beats not done today
// and the suggested drill. Everything else that pays is a single item to
// replay for points.

import assert from "node:assert/strict";
import test from "node:test";

import { isAssigned, questHrefs } from "@/lib/assigned";
import { mathHref, vocabHref } from "@/components/drill/options";

const beats = [
  { id: "review", done: true, href: "/learn/today/review" },
  { id: "read", done: false, href: "/learn/abc/read" },
  { id: "math", done: false, href: "/math/fractions" },
  { id: "new", done: false, href: null },
];
const q = (s = "") => new URLSearchParams(s);

test("assigned: the quest beats not done today, and only those", () => {
  const quest = questHrefs(beats);
  assert.deepEqual(quest, ["/learn/abc/read", "/math/fractions"]);
  const a = { quest, drill: null };
  assert.ok(isAssigned("/math/fractions", q(), a));
  assert.ok(!isAssigned("/math/decimals", q(), a), "a skill off the list");
  assert.ok(!isAssigned("/learn/today/review", q("r=123"), a), "a beat done today, again");
  assert.ok(!isAssigned("/learn/abc/match", q(), a), "a unit's other step");
  // The Reading beat may send him to a passage on another list.
  assert.ok(isAssigned("/learn/xyz/read", q("saved=2026-10-04"), a));
});

test("assigned: the suggested drill in everything but its seed", () => {
  const drill = vocabHref({ source: { kind: "weak" }, mode: "spell", count: 10, seed: 111 });
  const a = { quest: [], drill };
  const [path, query] = drill.split("?");
  const same = q(query);
  same.set("seed", "999");
  assert.ok(isAssigned(path, same, a), "the same drill, dealt again by the redirect");
  const other = q(query);
  other.set("mode", "match");
  assert.ok(!isAssigned(path, other, a), "another drill type");
  const shorter = q(query);
  shorter.set("n", "5");
  assert.ok(!isAssigned(path, shorter, a));
  assert.ok(!isAssigned("/drill/math", same, a));
  // A math drill at an easy level he picked is not the suggestion at "auto".
  const math = mathHref({ skill: "fractions", level: "auto", count: 10, mode: "relaxed", seed: 5 });
  const [mPath, mQuery] = math.split("?");
  const easy = q(mQuery);
  easy.set("level", "1");
  assert.ok(isAssigned(mPath, q(mQuery), { quest: [], drill: math }));
  assert.ok(!isAssigned(mPath, easy, { quest: [], drill: math }));
});

test("assigned: nothing handed, nothing open", () => {
  assert.ok(!isAssigned("/drill/vocab", q("src=all&mode=spell&n=10"), { quest: [], drill: null }));
  assert.ok(!isAssigned("/math/tables", q(), { quest: questHrefs(beats), drill: null }));
});
