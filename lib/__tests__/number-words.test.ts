import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_NUMBER,
  fromWords,
  group,
  hintFor,
  numberWordList,
  toExpanded,
  toExpandedParts,
  toUnitForm,
  toWords,
} from "@/lib/number-words";

test("the numbers from his own worksheet come out right", () => {
  // Word form — the column he scored about 0 of 20 on.
  assert.equal(toWords(11), "eleven");
  assert.equal(toWords(18), "eighteen");
  assert.equal(toWords(29), "twenty-nine");
  assert.equal(toWords(39), "thirty-nine");
  assert.equal(toWords(55), "fifty-five");
  assert.equal(toWords(58), "fifty-eight");
  assert.equal(toWords(60), "sixty");
  assert.equal(toWords(62), "sixty-two");
  assert.equal(toWords(81), "eighty-one");
  assert.equal(toWords(87), "eighty-seven");
  assert.equal(toWords(90), "ninety");
  assert.equal(toWords(99), "ninety-nine");
});

test("forty has no u and fifty is not fivety", () => {
  assert.equal(toWords(40), "forty");
  assert.equal(toWords(45), "forty-five");
  assert.equal(toWords(50), "fifty");
  assert.equal(toWords(15), "fifteen");
});

test("big numbers read the way the worksheet writes them", () => {
  assert.equal(toWords(372), "three hundred seventy-two");
  assert.equal(toWords(3594), "three thousand five hundred ninety-four");
  assert.equal(toWords(49379), "forty-nine thousand three hundred seventy-nine");
  assert.equal(toWords(98100), "ninety-eight thousand one hundred");
  assert.equal(toWords(3700), "three thousand seven hundred");
  assert.equal(toWords(0), "zero");
});

test("words go back to the number they came from", () => {
  for (const n of [0, 7, 11, 19, 20, 40, 55, 81, 99, 100, 372, 1000, 3594, 49379, 98100, MAX_NUMBER]) {
    assert.equal(fromWords(toWords(n)), n, `round trip ${n}`);
  }
});

test("every number under a thousand round-trips", () => {
  for (let n = 0; n <= 999; n++) {
    assert.equal(fromWords(toWords(n)), n, `round trip ${n}`);
  }
});

test("out of range is refused rather than guessed at", () => {
  assert.equal(toWords(-1), "");
  assert.equal(toWords(1_000_000), "");
  assert.equal(toWords(1.5), "");
  assert.equal(fromWords("fefte five"), null, "a misspelling is not a number");
  assert.equal(fromWords(""), null);
  assert.equal(fromWords("banana"), null);
});

test("expanded form drops the zero places, like the worksheet example", () => {
  assert.deepEqual(toExpandedParts(23493), [20000, 3000, 400, 90, 3]);
  assert.deepEqual(toExpandedParts(98100), [90000, 8000, 100]);
  assert.deepEqual(toExpandedParts(3700), [3000, 700]);
  assert.equal(toExpanded(49379), "40,000 + 9,000 + 300 + 70 + 9");
  assert.equal(toExpanded(890), "800 + 90");
});

test("unit form counts each place, singular when there is one", () => {
  assert.equal(toUnitForm(49379), "4 ten thousands 9 thousands 3 hundreds 7 tens 9 ones");
  assert.equal(toUnitForm(340), "3 hundreds 4 tens");
  assert.equal(toUnitForm(11), "1 ten 1 one");
  assert.equal(toUnitForm(0), "0 ones");
});

test("group puts the comma where the worksheet puts it", () => {
  assert.equal(group(23493), "23,493");
  assert.equal(group(890), "890");
  assert.equal(group(1000), "1,000");
});

test("the hint names the rule he actually broke", () => {
  // Straight off his worksheet.
  assert.match(hintFor("fefte", "fifty") ?? "", /f-i-f/);
  assert.match(hintFor("therte", "thirty") ?? "", /t-h-i-r/);
  assert.match(hintFor("ghate", "eighty") ?? "", /e-i-g-h/);
  assert.match(hintFor("ay tene", "eighteen") ?? "", /e-i-g-h/);
  assert.match(hintFor("ninel", "ninety") ?? "", /nine/);
  assert.match(hintFor("twene", "twenty") ?? "", /t-y/);
  assert.match(hintFor("fourty", "forty") ?? "", /no u/);
  // A tens word that missed the ending still gets the general rule.
  assert.match(hintFor("seventeee", "seventy") ?? "", /six|seven|t-y/);
});

test("no hint when there is nothing useful to say", () => {
  assert.equal(hintFor("fifty", "fifty"), null, "a right answer needs no hint");
  assert.equal(hintFor("", "fifty"), null);
  assert.equal(hintFor("fifty", ""), null);
});

test("the spelling pack covers the words he missed", () => {
  const words = numberWordList();
  for (const w of ["fifty", "thirty", "sixty", "eighty", "ninety", "twenty", "eleven", "eighteen", "forty"]) {
    assert.ok(words.includes(w), `${w} is in the list`);
  }
});
