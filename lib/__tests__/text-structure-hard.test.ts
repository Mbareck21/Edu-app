// Text structure gets harder once it is mastered (2026-11-15 sweep): a second
// pool of longer passages that cannot be answered from their signal words,
// and a rule that moves a child onto it and back off it.

import assert from "node:assert/strict";
import test from "node:test";

import { mulberry32 } from "@/lib/math/rng";
import { countWords, splitSentences } from "@/lib/reading";
import {
  HARD_STRUCTURE_PASSAGES,
  STRUCTURE_DOWN_PCT,
  STRUCTURE_HISTORY,
  STRUCTURE_IDS,
  STRUCTURE_PASSAGES,
  STRUCTURE_ROUNDS,
  STRUCTURE_UP_PCT,
  TEXT_STRUCTURES,
  findSignalWords,
  passagesFor,
  rememberDealt,
  structureById,
  structureLevel,
  structureLevelFrom,
  structureSession,
} from "@/lib/text-structure";

const pct = (right: number) => Math.round((right / STRUCTURE_ROUNDS) * 100);

// ── When a child moves to the harder passages ─────────────────────────────

test("three good sessions in a row open the harder passages", () => {
  // Six rounds a session: 5 of 6 is a good one, 4 of 6 is not.
  assert.ok(pct(5) >= STRUCTURE_UP_PCT);
  assert.ok(pct(4) < STRUCTURE_UP_PCT);
  assert.equal(structureLevel([]), 1);
  assert.equal(structureLevel([100, 100]), 1);
  assert.equal(structureLevel([100, 83, 100]), 2);
  assert.equal(structureLevel([100, 100, 67]), 1, "a weak session breaks the run");
  assert.equal(structureLevel([67, 100, 100, 83]), 2, "the run can start late");
});

test("one hard session that goes badly does not send him back; two in a row do", () => {
  const up = [100, 100, 100];
  assert.ok(pct(2) < STRUCTURE_DOWN_PCT);
  assert.ok(pct(3) >= STRUCTURE_DOWN_PCT);
  assert.equal(structureLevel([...up, 33]), 2);
  assert.equal(structureLevel([...up, 33, 100, 33]), 2);
  assert.equal(structureLevel([...up, 33, 17]), 1);
  assert.equal(structureLevel([...up, 50, 50, 50]), 2, "half right is thin, not failing");
});

test("sessions from before a move never count toward the next one", () => {
  // Back at level 1 after two bad hard sessions: the three good easy sessions
  // that opened level 2 must not open it again on their own.
  assert.equal(structureLevel([100, 100, 100, 0, 0]), 1);
  assert.equal(structureLevel([100, 100, 100, 0, 0, 100, 100]), 1);
  assert.equal(structureLevel([100, 100, 100, 0, 0, 100, 100, 100]), 2);
});

test("the level is read from his own structure sessions, newest first in the log", () => {
  const at = "2026-11-15T00:00:00.000Z";
  const s = (p: number) => ({ at, kind: "reading" as const, ref: "read:structure", pct: p, xp: 0, ms: 0 });
  const other = { at, kind: "reading" as const, ref: "read:abc@2026", pct: 0, xp: 0, ms: 0 };
  // Newest first, as the profile keeps it: a weak one long ago, then three good.
  assert.equal(structureLevelFrom([s(100), other, s(83), s(100), other, s(33)]), 2);
  assert.equal(structureLevelFrom([s(67), s(100), s(100)]), 1);
  assert.equal(structureLevelFrom([other, other]), 1);
  assert.equal(structureLevelFrom([]), 1);
});

// ── The harder passages are harder, and stay honest ───────────────────────

test("eight harder passages for every structure, none sharing an id or a title", () => {
  for (const id of STRUCTURE_IDS) assert.equal(passagesFor(id, 2).length, 8, id);
  assert.equal(HARD_STRUCTURE_PASSAGES.length, 40);
  const all = [...STRUCTURE_PASSAGES, ...HARD_STRUCTURE_PASSAGES];
  assert.equal(new Set(all.map((p) => p.id)).size, all.length);
  assert.equal(new Set(all.map((p) => p.title.toLowerCase())).size, all.length);
  // Level 1 is untouched: the same forty, and none of the hard ones among them.
  assert.equal(STRUCTURE_PASSAGES.length, 40);
  for (const id of STRUCTURE_IDS) assert.equal(passagesFor(id).length, 8, id);
});

test("no word is in two hard titles, so no title word can point at a structure", () => {
  const seen = new Map<string, string>();
  for (const p of HARD_STRUCTURE_PASSAGES) {
    for (const word of new Set(p.title.toLowerCase().match(/[a-z']+/g) ?? [])) {
      assert.equal(seen.get(word), undefined, `"${word}" is in "${seen.get(word)}" and "${p.title}"`);
      seen.set(word, p.title);
    }
  }
});

test("a hard passage is longer and its sentences stay readable", () => {
  for (const p of HARD_STRUCTURE_PASSAGES) {
    const words = countWords(p.text);
    assert.ok(words >= 100 && words <= 150, `${p.id}: ${words} words`);
    for (const sentence of splitSentences(p.text)) {
      assert.ok(countWords(sentence) <= 24, `${p.id}: ${countWords(sentence)} words in "${sentence}"`);
    }
  }
  const mean = (ps: readonly { text: string }[]) => ps.reduce((n, p) => n + countWords(p.text), 0) / ps.length;
  assert.ok(mean(HARD_STRUCTURE_PASSAGES) > mean(STRUCTURE_PASSAGES) * 1.4);
});

test("a hard passage cannot be answered from its signal words", () => {
  for (const p of HARD_STRUCTURE_PASSAGES) {
    const own = structureById(p.structure).signalWords;
    // The marked words are real, and they are this structure's own.
    assert.ok(p.signalWords.length >= 1, `${p.id}: nothing to mark once he has answered`);
    for (const word of p.signalWords) {
      assert.ok(own.includes(word), `${p.id}: "${word}" is not a ${p.structure} signal word`);
      assert.ok(findSignalWords(p.text, [word]).length > 0, `${p.id}: "${word}" is not in the text`);
    }
    // Few of its own, and every one that is there is marked.
    const ownHits = findSignalWords(p.text, own);
    assert.ok(ownHits.length <= 3, `${p.id}: ${ownHits.length} of its own signal words`);
    for (const hit of ownHits) assert.ok(p.signalWords.includes(hit.word), `${p.id}: "${hit.word}" is unmarked`);
    // And at least one that belongs to another structure only.
    const others = TEXT_STRUCTURES.filter((s) => s.id !== p.structure)
      .flatMap((s) => s.signalWords)
      .filter((w) => !own.includes(w));
    assert.ok(findSignalWords(p.text, others).length >= 1, `${p.id}: no signal word from another structure`);
  }
});

test("no hard passage opens a sentence on its own structure's frame words", () => {
  // "First, ...", "The problem is ...", "As a result, ..." at the head of
  // sentence after sentence is what made level 1 answerable at a glance.
  // One such opener is allowed; a passage built on them is not.
  for (const p of HARD_STRUCTURE_PASSAGES) {
    const own = structureById(p.structure).signalWords;
    const openers = splitSentences(p.text).filter((sentence) =>
      own.some((w) => new RegExp(`^${w}\\b`, "i").test(sentence))
    );
    assert.ok(openers.length <= 1, `${p.id}: ${openers.length} sentences open on a signal word`);
  }
});

test("the hard passages are in the English his school grades him in", () => {
  const BRITISH = /(colour|vapour|autumn|towards|behaviour|grey|centre|metre|practise|realise|neighbour|favourite)/i;
  for (const p of HARD_STRUCTURE_PASSAGES) {
    assert.equal(p.text.match(BRITISH) ?? p.title.match(BRITISH), null, p.id);
    assert.equal(p.source, "app");
  }
});

// ── Dealing a session at each level ───────────────────────────────────────

test("a level 2 session is six hard passages, every structure, one twice", () => {
  const hard = new Set(HARD_STRUCTURE_PASSAGES.map((p) => p.id));
  for (let seed = 1; seed <= 60; seed++) {
    const session = structureSession(mulberry32(seed), [], 4, 2);
    assert.equal(session.length, STRUCTURE_ROUNDS);
    assert.equal(new Set(session.map((r) => r.passage.id)).size, STRUCTURE_ROUNDS);
    assert.equal(new Set(session.map((r) => r.passage.structure)).size, STRUCTURE_IDS.length);
    for (const round of session) {
      assert.ok(hard.has(round.passage.id), `seed ${seed} dealt ${round.passage.id}`);
      assert.equal(round.choices.answer, round.passage.structure);
    }
  }
});

test("a level 1 session never deals a hard passage", () => {
  const hard = new Set(HARD_STRUCTURE_PASSAGES.map((p) => p.id));
  for (let seed = 1; seed <= 60; seed++) {
    for (const round of structureSession(mulberry32(seed))) assert.ok(!hard.has(round.passage.id));
    for (const round of structureSession(mulberry32(seed), [], 4, 1)) assert.ok(!hard.has(round.passage.id));
  }
});

test("200 hard sessions in a row repeat nothing from the last three, and use all forty", () => {
  let recent: string[] = [];
  const seen = new Set<string>();
  for (let s = 1; s <= 200; s++) {
    const session = structureSession(mulberry32(s * 7919), recent, 4, 2);
    const again = session.filter((r) => recent.includes(r.passage.id)).map((r) => r.passage.id);
    assert.deepEqual(again, [], `session ${s} dealt ${again.join(", ")} again`);
    for (const r of session) seen.add(r.passage.id);
    recent = rememberDealt(recent, session);
    assert.ok(recent.length <= STRUCTURE_HISTORY);
  }
  assert.equal(seen.size, HARD_STRUCTURE_PASSAGES.length);
});

test("the first hard session after level 1 is all new texts", () => {
  // His history holds level 1 ids. None of them is in the hard pool, so the
  // move up is six passages he has never seen.
  let recent: string[] = [];
  for (let s = 0; s < 3; s++) recent = rememberDealt(recent, structureSession(mulberry32(40 + s), recent));
  const session = structureSession(mulberry32(7), recent, 4, 2);
  assert.equal(session.filter((r) => recent.includes(r.passage.id)).length, 0);
});
