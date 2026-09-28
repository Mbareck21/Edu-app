import assert from "node:assert/strict";
import { test } from "node:test";

import { mulberry32, shuffle } from "@/lib/math/rng";
import {
  STRUCTURE_HISTORY,
  STRUCTURE_IDS,
  STRUCTURE_PASSAGES,
  TEXT_STRUCTURES,
  findSignalWords,
  rememberDealt,
  structureById,
  structureChoices,
  structureSession,
  STRUCTURE_ROUNDS,
  passagesFor,
} from "@/lib/text-structure";

test("every passage's declared signal words really appear in its text", () => {
  for (const passage of STRUCTURE_PASSAGES) {
    for (const word of passage.signalWords) {
      const hits = findSignalWords(passage.text, [word]);
      assert.ok(hits.length > 0, `"${word}" not found in ${passage.id}`);
    }
  }
});

test("every structure has a distinct id, name, question and a non-empty frame", () => {
  assert.equal(TEXT_STRUCTURES.length, STRUCTURE_IDS.length);
  assert.equal(new Set(TEXT_STRUCTURES.map((s) => s.id)).size, TEXT_STRUCTURES.length);
  assert.equal(new Set(TEXT_STRUCTURES.map((s) => s.name)).size, TEXT_STRUCTURES.length);
  assert.equal(new Set(TEXT_STRUCTURES.map((s) => s.question)).size, TEXT_STRUCTURES.length);
  for (const structure of TEXT_STRUCTURES) {
    assert.ok(structure.frame.length > 0, `${structure.id} has an empty frame`);
    assert.ok(structure.signalWords.length > 0, `${structure.id} has no signal words`);
  }
});

test("every structure has at least eight passages", () => {
  // One passage each meant the lesson ran the same five texts in the same
  // order every time, so he could answer from position without reading. Three
  // each were memorised within a week (2026-09-27). Eight is also what lets a
  // session skip everything from his last three (see STRUCTURE_HISTORY).
  const perSession = 2; // one round each, plus the encore
  const sessions = STRUCTURE_HISTORY / STRUCTURE_ROUNDS;
  for (const id of STRUCTURE_IDS) {
    assert.ok(passagesFor(id).length >= 8, `only ${passagesFor(id).length} for ${id}`);
    assert.ok(passagesFor(id).length >= perSession * (sessions + 1), `${id} runs out inside the history`);
  }
  assert.ok(STRUCTURE_PASSAGES.length >= 40);
});

test("no two passages share an id or a title", () => {
  assert.equal(new Set(STRUCTURE_PASSAGES.map((p) => p.id)).size, STRUCTURE_PASSAGES.length);
  const titles = STRUCTURE_PASSAGES.map((p) => p.title.toLowerCase());
  assert.equal(new Set(titles).size, titles.length);
});

test("no word in a title gives the structure away", () => {
  // The title is on screen before he answers. Every title with "and" in it
  // was compare and contrast and no other title had one, so "and" answered
  // the question without reading. A word several titles share must be spread
  // over the structures: no one structure may hold more than half of them.
  const uses = new Map<string, string[]>();
  for (const p of STRUCTURE_PASSAGES) {
    for (const word of new Set(p.title.toLowerCase().match(/[a-z']+/g) ?? [])) {
      uses.set(word, [...(uses.get(word) ?? []), p.structure]);
    }
  }
  for (const [word, structures] of uses) {
    if (structures.length < 2) continue;
    const most = Math.max(...STRUCTURE_IDS.map((id) => structures.filter((s) => s === id).length));
    assert.ok(
      most * 2 <= structures.length,
      `"${word}" is in ${structures.length} titles and ${most} of them are one structure`
    );
    if (structures.length >= 3) assert.ok(new Set(structures).size >= 2, `"${word}" names one structure`);
  }
});

test("the teacher's five passages are still here, word for word", () => {
  // These are his actual homework. A later edit must not quietly reword them.
  const teacher = STRUCTURE_PASSAGES.filter((p) => p.source === "teacher");
  assert.equal(teacher.length, 5);
  assert.deepEqual(
    teacher.map((p) => p.id).sort(),
    ["butterfly-grows", "frogs-toads", "ocean-plastic", "sea-otters", "wildfires"]
  );
  // One structure each, so a session can always draw a teacher passage.
  assert.equal(new Set(teacher.map((p) => p.structure)).size, 5);
  const otters = teacher.find((p) => p.id === "sea-otters");
  assert.ok(
    otters?.text.startsWith("Sea otters are amazing ocean animals with many interesting features."),
    "the sea otters passage has been reworded"
  );
});

test("passages are written in the English his school grades him in", () => {
  // He is at an Arkansas public school and spelling is his weakest skill, so
  // the app must not teach a spelling his teacher marks wrong. Ten passages
  // added on 2026-09-01 shipped colour/vapour/autumn/towards before this.
  const BRITISH = /(colour|colours|vapour|autumn|towards|behaviour|grey|centre|metre|practise|realise|neighbour|favourite)/i;
  for (const passage of STRUCTURE_PASSAGES) {
    const hit = passage.text.match(BRITISH) ?? passage.title.match(BRITISH);
    assert.equal(hit, null, `${passage.id} uses "${hit?.[0]}"`);
  }
});

test("no structure can be answered by elimination", () => {
  // One round per structure meant the fifth answer was free: whatever had not
  // come up yet. The session runs one extra round so counting settles nothing.
  for (let seed = 1; seed <= 60; seed++) {
    const session = structureSession(mulberry32(seed));
    assert.equal(session.length, STRUCTURE_ROUNDS);
    assert.ok(STRUCTURE_ROUNDS > STRUCTURE_IDS.length, "an extra round is what breaks the count");
    const counts = new Map<string, number>();
    for (const r of session) {
      counts.set(r.passage.structure, (counts.get(r.passage.structure) ?? 0) + 1);
    }
    // Still every structure practised, but one appears twice.
    assert.equal(counts.size, STRUCTURE_IDS.length, `seed ${seed} skipped a structure`);
    assert.ok([...counts.values()].some((n) => n === 2), `seed ${seed} has no repeat`);
    // The repeat should be a different text where the pool allows one.
    assert.equal(new Set(session.map((r) => r.passage.id)).size, session.length);
  }
});

test("a session covers all five structures in a varying order", () => {
  const ids = (seed: number) => structureSession(mulberry32(seed)).map((r) => r.passage.structure);
  for (let seed = 1; seed <= 50; seed++) {
    const session = structureSession(mulberry32(seed));
    assert.equal(session.length, STRUCTURE_ROUNDS);
    assert.equal(new Set(session.map((r) => r.passage.structure)).size, 5);
    for (const round of session) {
      assert.equal(round.choices.answer, round.passage.structure);
    }
  }
  // The order is not fixed — this is what stopped him answering by position.
  const orders = new Set(Array.from({ length: 40 }, (_, i) => ids(i + 1).join(",")));
  assert.ok(orders.size >= 10, `only ${orders.size} distinct orders in 40 sessions`);
});

test("a session draws different texts, not just a different order", () => {
  const texts = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    for (const round of structureSession(mulberry32(seed))) texts.add(round.passage.id);
  }
  // Every passage in the pool should be reachable.
  assert.equal(texts.size, STRUCTURE_PASSAGES.length);
});

test("the same seed gives the same session", () => {
  // The page renders on the server and hydrates on the client from one seed.
  const a = structureSession(mulberry32(99)).map((r) => r.passage.id);
  const b = structureSession(mulberry32(99)).map((r) => r.passage.id);
  assert.deepEqual(a, b);
  // A resumed run rebuilds from its seed and the history it was dealt against.
  const recent = a.slice(0, 4);
  assert.deepEqual(
    structureSession(mulberry32(99), recent).map((r) => r.passage.id),
    structureSession(mulberry32(99), recent).map((r) => r.passage.id)
  );
});

test("a session skips the passages dealt recently", () => {
  for (let seed = 1; seed <= 200; seed++) {
    // Three sessions' worth of history, dealt the way the runner deals it.
    let recent: string[] = [];
    for (let s = 0; s < 3; s++) {
      recent = rememberDealt(recent, structureSession(mulberry32(seed * 31 + s), recent));
    }
    assert.equal(recent.length, STRUCTURE_HISTORY);
    const session = structureSession(mulberry32(seed), recent);
    const again = session.filter((r) => recent.includes(r.passage.id)).map((r) => r.passage.id);
    assert.deepEqual(again, [], `seed ${seed} dealt ${again.join(", ")} again`);
    // Still a full session: every structure, one twice, six different texts.
    assert.equal(new Set(session.map((r) => r.passage.structure)).size, STRUCTURE_IDS.length);
    assert.equal(new Set(session.map((r) => r.passage.id)).size, STRUCTURE_ROUNDS);
  }
});

test("with nothing unseen left, the passage seen longest ago comes back", () => {
  // Every passage in the history, in a known order: the oldest of each
  // structure is the one to deal (and the next oldest for the encore).
  const recent = shuffle(mulberry32(5), STRUCTURE_PASSAGES.map((p) => p.id));
  const session = structureSession(mulberry32(8), recent);
  for (const id of STRUCTURE_IDS) {
    const dealt = session.filter((r) => r.passage.structure === id).map((r) => r.passage.id);
    const oldestFirst = passagesFor(id)
      .map((p) => p.id)
      .sort((a, b) => recent.indexOf(a) - recent.indexOf(b));
    assert.deepEqual(dealt.sort(), oldestFirst.slice(0, dealt.length).sort(), id);
  }
});

test("200 sessions in a row repeat nothing from the session before", () => {
  // The audit that found the farm: without a history a session repeated 2.4
  // of the last one's six texts, and 97.5% of sessions repeated at least one.
  let recent: string[] = [];
  let previous: string[] = [];
  let repeats = 0;
  const seen = new Set<string>();
  for (let s = 1; s <= 200; s++) {
    const session = structureSession(mulberry32(s * 7919), recent);
    const ids = session.map((r) => r.passage.id);
    repeats += ids.filter((id) => previous.includes(id)).length;
    for (const id of ids) seen.add(id);
    recent = rememberDealt(recent, session);
    previous = ids;
  }
  assert.equal(repeats / 199, 0);
  // Steering away from repeats must not strand part of the bank.
  assert.equal(seen.size, STRUCTURE_PASSAGES.length);
});

test("structure choices include the right answer and plausible distractors", () => {
  for (const passage of STRUCTURE_PASSAGES) {
    const { options, answer } = structureChoices(passage, mulberry32(7));
    assert.equal(answer, passage.structure);
    assert.equal(options.length, 4);
    assert.ok(options.some((o) => o.id === answer), `${passage.id}: answer missing`);
    assert.equal(new Set(options.map((o) => o.id)).size, options.length);
  }
});

test("structure choices are deterministic for a fixed seed", () => {
  const passage = STRUCTURE_PASSAGES[0];
  const a = structureChoices(passage, mulberry32(42));
  const b = structureChoices(passage, mulberry32(42));
  assert.deepEqual(
    a.options.map((o) => o.id),
    b.options.map((o) => o.id)
  );
  const c = structureChoices(passage, mulberry32(43));
  // A different seed is allowed to give the same order by chance, but the
  // answer must still be there either way.
  assert.ok(c.options.some((o) => o.id === passage.structure));
});

test("signal word finder respects word boundaries", () => {
  // "cause" must not light up inside "because".
  assert.deepEqual(findSignalWords("It happened because of rain.", ["cause"]), []);
  // "first" must not light up inside "firstly" or "thirst".
  assert.deepEqual(findSignalWords("Firstly, he felt thirst.", ["first"]), []);
  // Trailing punctuation is not part of the word — "First," is still found.
  const hits = findSignalWords("First, we mixed the batter.", ["first"]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].index, 0);
  assert.equal(hits[0].length, 5);
});

test("signal word finder ignores case and finds phrases", () => {
  const text = "IN ADDITION, otters use rocks. As a result, they eat well.";
  const hits = findSignalWords(text, ["in addition", "as a result"]);
  assert.deepEqual(
    hits.map((h) => h.word),
    ["in addition", "as a result"]
  );
  // Matches come back in text order with real positions for slicing.
  assert.equal(text.slice(hits[0].index, hits[0].index + hits[0].length), "IN ADDITION");
});

test("structureById returns the record for every id", () => {
  for (const id of STRUCTURE_IDS) {
    assert.equal(structureById(id).id, id);
  }
});
