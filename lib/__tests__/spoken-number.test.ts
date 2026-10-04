import assert from "node:assert/strict";
import test from "node:test";

import { toWords } from "@/lib/number-words";
import { judgeSpoken, lastNumber } from "@/lib/spoken-number";
import { TABLES } from "@/lib/tables";

test("digits, words, and a whole fact said back all give the answer", () => {
  assert.equal(lastNumber("56"), 56);
  assert.equal(lastNumber("56."), 56);
  assert.equal(lastNumber("Fifty-six"), 56);
  assert.equal(lastNumber("fifty six"), 56);
  assert.equal(lastNumber("7 times 8 is 56"), 56);
  assert.equal(lastNumber("seven times eight is fifty six"), 56);
  assert.equal(lastNumber("It's 72!"), 72);
  assert.equal(lastNumber("one hundred"), 100);
});

test("a misheard sound still counts as its number", () => {
  assert.equal(lastNumber("ate"), 8);
  assert.equal(lastNumber("for"), 4);
});

test("no number at all is null", () => {
  assert.equal(lastNumber("um I don't know"), null);
  assert.equal(lastNumber(""), null);
});

test("any of the recogniser's guesses can carry the right answer", () => {
  assert.deepEqual(judgeSpoken(["fifty five", "fifty six"], 56), { heard: 56, correct: true });
  assert.deepEqual(judgeSpoken(["48"], 56), { heard: 48, correct: false });
  assert.deepEqual(judgeSpoken(["hmm"], 56), { heard: null, correct: false });
});

test("the question heard back is not an answer; what follows it is", () => {
  assert.equal(lastNumber("two times two"), null);
  assert.equal(lastNumber("2 times 2"), null);
  assert.equal(lastNumber("2 x 2"), null);
  assert.equal(lastNumber("two times two is four"), 4);
  assert.equal(lastNumber("2 times 2 equals 4"), 4);
  assert.equal(lastNumber("two times two four"), 4);
  assert.equal(lastNumber("seven times eight fifty six"), 56);
  assert.equal(lastNumber("7 times 8 is 56"), 56);
});

test("a quick 'four' misheard as a word still counts", () => {
  for (const heard of ["four", "for", "far", "fall", "floor", "Ford", "4", "4."]) {
    assert.equal(judgeSpoken([heard], 4).correct, true, heard);
  }
  assert.equal(judgeSpoken(["eat"], 8).correct, true);
  assert.equal(judgeSpoken(["nine"], 4).correct, false);
});

test("the twelves: answers past a hundred, with or without \"and\"", () => {
  assert.equal(lastNumber("144"), 144);
  assert.equal(lastNumber("one hundred forty four"), 144);
  assert.equal(lastNumber("one hundred and forty four"), 144);
  assert.equal(lastNumber("twelve times twelve is one hundred and forty four"), 144);
  assert.equal(lastNumber("eleven times ten is one hundred and ten"), 110);
});

test("\"is equal to\" and \"equals to\": the \"to\" is not a two", () => {
  // "seven times eight is equal to fifty six" read as 58: "to" heard as two,
  // added onto the fifty six. Half of every whole-fact phrasing went wrong.
  for (const a of TABLES) {
    for (let b = 2; b <= 12; b++) {
      const answer = a * b;
      for (const said of [toWords(answer), String(answer)]) {
        for (const joint of ["is equal to", "equals to"]) {
          const text = `${toWords(a)} times ${toWords(b)} ${joint} ${said}`;
          assert.equal(lastNumber(text), answer, text);
        }
      }
    }
  }
  assert.equal(lastNumber("it is equal to fifty six"), 56);
});

test("a run of number words is read as the one number at its end", () => {
  // Words that cannot make one number together: only the last number counts.
  assert.equal(lastNumber("two fifty six"), 56);
  assert.equal(lastNumber("um two twenty four"), 24);
});

test("\"one forty four\" is how a hundred and forty four is often said", () => {
  assert.equal(lastNumber("one forty four"), 144);
  assert.equal(lastNumber("twelve times twelve is one forty four"), 144);
  assert.equal(lastNumber("one twenty"), 120);
  assert.equal(lastNumber("one thirty two"), 132);
  assert.equal(lastNumber("eleven times twelve one thirty two"), 132);
  // A real number stays itself.
  assert.equal(lastNumber("forty four"), 44);
  assert.equal(lastNumber("one hundred forty four"), 144);
  // The "one" of "twenty one" said twice is not a hundred.
  assert.equal(lastNumber("twenty one twenty one"), 21);
});

test("counting up to the answer in one go is not knowing it", () => {
  // Said for 7 × 8. Every guess the recogniser makes on the way holds the
  // numbers before 56, so none of them counts.
  const upTo56 = [50, 51, 52, 53, 54, 55, 56];
  const growing = upTo56.map((_, i) => upTo56.slice(0, i + 1).join(" "));
  for (const said of [
    growing,
    ["50, 51, 52, 53, 54, 55, 56"],
    [upTo56.map(toWords).join(" ")],
    ["seven times eight is fifty fifty one fifty two fifty three fifty four fifty five fifty six"],
    ["59 58 57 56"],
    ["fifty five fifty six"],
  ]) {
    const judged = judgeSpoken(said, 56, [7, 8]);
    assert.equal(judged.correct, false, said.join(" | "));
    // What goes to the server as typed must not be the answer either.
    assert.notEqual(judged.heard, 56, said.join(" | "));
  }
  assert.deepEqual(judgeSpoken(growing, 56, [7, 8]), { heard: 50, correct: false });
  // Past the answer is as wrong, even when the answer came first.
  assert.deepEqual(judgeSpoken(["70 71 72"], 70, [7, 10]), { heard: 71, correct: false });
});

test("one answer said honestly is still right, the fact's own numbers and all", () => {
  for (const a of TABLES) {
    for (let b = 2; b <= 12; b++) {
      const answer = a * b;
      const [wa, wb, w] = [toWords(a), toWords(b), toWords(answer)];
      for (const said of [
        String(answer),
        w,
        `${a} times ${b} is ${answer}`,
        `${a} x ${b} = ${answer}`,
        `${wa} times ${wb} is ${w}`,
        `${wa} times ${wb} ${w}`,
        `${wa} times ${wb} is equal to ${w}`,
        `${wa} times ${wb} equals two ${w}`,
        `${wa} by ${wb} is ${w}`,
        `${wa} time ${wb} is ${w}`,
        `${wb} ${w}`,
        `${w} ${w}`,
        `um it's ${w}`,
      ]) {
        assert.deepEqual(judgeSpoken([said], answer, [a, b]), { heard: answer, correct: true }, said);
      }
    }
  }
  for (const [said, answer, a, b] of [
    ["two fifty six", 56, 7, 8],
    ["um two twenty four", 24, 4, 6],
    ["one forty four", 144, 12, 12],
    ["twelve times twelve is one forty four", 144, 12, 12],
    ["eleven times twelve one thirty two", 132, 11, 12],
    ["one hundred and forty four", 144, 12, 12],
    ["two times two four", 4, 2, 2],
    ["floor", 4, 2, 2],
  ] as const) {
    assert.equal(judgeSpoken([said], answer, [a, b]).correct, true, said);
  }
});

test("the recogniser's different spellings of one answer still pass", () => {
  assert.deepEqual(judgeSpoken(["56", "fifty six", "50 6"], 56, [7, 8]), { heard: 56, correct: true });
  assert.deepEqual(judgeSpoken(["50 6", "fifty six", "56"], 56, [7, 8]), { heard: 56, correct: true });
  assert.deepEqual(judgeSpoken(["50 6", "56"], 56), { heard: 56, correct: true });
});
