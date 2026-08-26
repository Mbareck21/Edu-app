/**
 * Whole numbers in the four forms his class uses this week: standard, word,
 * expanded and unit form.
 *
 * The reason this module exists is narrower than it looks. On his graded
 * worksheet he wrote 12 of 12 numbers correctly in standard form and 11 of 12
 * in expanded form, then scored about 0 of 20 writing the same numbers in
 * WORDS: fefte for fifty, therte for thirty, ghate for eighty, ninel for
 * ninety. The arithmetic is not the problem. Spelling English number words is.
 *
 * So `toWords` has to be exactly right — it is the answer key he is marked
 * against — and `hintFor` exists to name the rule he broke instead of just
 * telling him he is wrong again.
 *
 * Pure: no React, no Mongoose, no DOM.
 */

/** Grade 4 reads and writes to the hundred thousands. */
export const MAX_NUMBER = 999_999;

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
] as const;

const TEENS = [
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;

/** Index is the tens digit, so index 0 and 1 are never read from. */
const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
] as const;

/** "43207" -> "43,207". The comma is how the worksheet prints it. */
export function group(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return n < 0 ? `-${out}` : out;
}

/** 0..999 in words. No "and" — that is how his worksheet writes it. */
function underThousand(n: number): string {
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)];
    const ones = n % 10;
    // The hyphen is part of the spelling, not decoration: "forty-two".
    return ones === 0 ? tens : `${tens}-${ONES[ones]}`;
  }
  const hundreds = `${ONES[Math.floor(n / 100)]} hundred`;
  const rest = n % 100;
  return rest === 0 ? hundreds : `${hundreds} ${underThousand(rest)}`;
}

/**
 * 55 -> "fifty-five", 81 -> "eighty-one", 49379 -> "forty-nine thousand three
 * hundred seventy-nine". Returns "" for anything outside 0..MAX_NUMBER.
 */
export function toWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > MAX_NUMBER) return "";
  if (n < 1000) return underThousand(n);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const head = `${underThousand(thousands)} thousand`;
  return rest === 0 ? head : `${head} ${underThousand(rest)}`;
}

const WORD_VALUE = new Map<string, number>();
ONES.forEach((w, i) => WORD_VALUE.set(w, i));
TEENS.forEach((w, i) => WORD_VALUE.set(w, i + 10));
TENS.forEach((w, i) => {
  if (w) WORD_VALUE.set(w, i * 10);
});

/**
 * "fifty-five" -> 55. Returns null when it is not a number he could have
 * meant, so a caller can tell "wrong number" from "wrong spelling".
 */
export function fromWords(text: string): number | null {
  const parts = text
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && w !== "and");
  if (parts.length === 0) return null;

  let total = 0;
  let chunk = 0;
  let sawWord = false;
  for (const part of parts) {
    if (part === "hundred") {
      // "hundred" with nothing in front of it is still one hundred.
      chunk = (chunk === 0 ? 1 : chunk) * 100;
      sawWord = true;
      continue;
    }
    if (part === "thousand") {
      total += (chunk === 0 ? 1 : chunk) * 1000;
      chunk = 0;
      sawWord = true;
      continue;
    }
    const value = WORD_VALUE.get(part);
    if (value === undefined) return null;
    chunk += value;
    sawWord = true;
  }
  if (!sawWord) return null;
  const n = total + chunk;
  return n > MAX_NUMBER ? null : n;
}

/**
 * 49379 -> [40000, 9000, 300, 70, 9]. Zero places are dropped, which is the
 * convention the worksheet's own example uses (23,493 = 20,000 + 3,000 + 400 +
 * 90 + 3). He wrote the zeros in once; harmless, but this is the model answer.
 */
export function toExpandedParts(n: number): number[] {
  if (!Number.isInteger(n) || n <= 0 || n > MAX_NUMBER) return n === 0 ? [0] : [];
  const digits = String(n).split("");
  const out: number[] = [];
  digits.forEach((d, i) => {
    const value = Number(d) * 10 ** (digits.length - 1 - i);
    if (value > 0) out.push(value);
  });
  return out;
}

/** 49379 -> "40,000 + 9,000 + 300 + 70 + 9". */
export function toExpanded(n: number): string {
  const parts = toExpandedParts(n);
  return parts.length === 0 ? "" : parts.map(group).join(" + ");
}

export type UnitPart = { count: number; unit: string };

const PLACE_UNITS = [
  "ones",
  "tens",
  "hundreds",
  "thousands",
  "ten thousands",
  "hundred thousands",
] as const;

/** Singular when there is exactly one of them: "1 ten", not "1 tens". */
function unitName(place: number, count: number): string {
  const plural = PLACE_UNITS[place];
  return count === 1 ? plural.replace(/s$/, "") : plural;
}

/**
 * 49379 -> [{4,"ten thousands"},{9,"thousands"},{3,"hundreds"},{7,"tens"},
 * {9,"ones"}]. Unit form is the one of the four his teacher named that the app
 * did not already have anywhere.
 */
export function toUnitParts(n: number): UnitPart[] {
  if (!Number.isInteger(n) || n < 0 || n > MAX_NUMBER) return [];
  const digits = String(n).split("");
  const out: UnitPart[] = [];
  digits.forEach((d, i) => {
    const count = Number(d);
    if (count === 0) return;
    const place = digits.length - 1 - i;
    out.push({ count, unit: unitName(place, count) });
  });
  return out;
}

/** 49379 -> "4 ten thousands 9 thousands 3 hundreds 7 tens 9 ones". */
export function toUnitForm(n: number): string {
  const parts = toUnitParts(n);
  if (parts.length === 0) return n === 0 ? "0 ones" : "";
  return parts.map((p) => `${p.count} ${p.unit}`).join(" ");
}

/** Every number word this module can produce, for a spelling pack to draw on. */
export function numberWordList(): string[] {
  return [...ONES.slice(1), ...TEENS, ...TENS.filter(Boolean), "hundred", "thousand"];
}

/* ------------------------------------------------------------------ *
 * Spelling help
 * ------------------------------------------------------------------ */

/**
 * The rules he actually broke, in the order worth telling him about.
 *
 * Every pattern here came off his own worksheet, so the hint he gets names the
 * mistake he made rather than a generic "try again". `test` runs against what
 * he typed, lowercased and stripped of spaces and hyphens.
 */
const HINTS: readonly { when: RegExp; target: RegExp; say: string }[] = [
  {
    // fefte, fefty, fivety -> fifty. The one he missed most.
    when: /^(fe|fi|fiv)/,
    target: /^fifty/,
    say: "Fifty starts f-i-f, not like the word five.",
  },
  {
    // therte, thirte -> thirty. Three loses its "ee" sound here.
    when: /^th/,
    target: /^thirty/,
    say: "Thirty starts t-h-i-r, like third.",
  },
  {
    // ghate, ayte -> eighty / eighteen. The eigh- spelling has no g first.
    when: /^(gh|ay|ei|ai|a)/,
    target: /^eigh/,
    say: "Both eighty and eighteen start e-i-g-h.",
  },
  {
    // fourty -> forty. The classic: four keeps its u, forty drops it.
    when: /^four/,
    target: /^forty/,
    say: "Forty has no u, even though four does.",
  },
  {
    // ninty -> ninety. Nine keeps its e.
    when: /^nin/,
    target: /^ninety/,
    say: "Ninety keeps the e from nine.",
  },
  {
    // twene, twenti -> twenty.
    when: /^tw/,
    target: /^twenty/,
    say: "Twenty ends t-y, like plenty.",
  },
  {
    // sexte -> sixty.
    when: /^s/,
    target: /^(sixty|sixteen|seventy|seventeen)/,
    say: "Say the number first: six, then sixty. Seven, then seventy.",
  },
];

/** A tens word always ends in -ty. That is the rule he broke the most. */
const TENS_WORD = /^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)$/;

function bare(text: string): string {
  return text.toLowerCase().replace(/[\s-]/g, "");
}

/**
 * One short line telling him which spelling rule he missed, or null when
 * nothing useful can be said. Shown under a wrong answer instead of a second
 * "not this time".
 *
 * `typed` is what he wrote, `target` the word he was asked for.
 */
export function hintFor(typed: string, target: string): string | null {
  const got = bare(typed);
  const want = bare(target);
  if (!got || !want || got === want) return null;

  for (const hint of HINTS) {
    if (hint.target.test(want) && hint.when.test(got)) return hint.say;
  }
  // He reached for a tens word and did not land the ending.
  if (TENS_WORD.test(want) && !got.endsWith("ty")) {
    return "Every tens word ends in t-y: twenty, thirty, forty, fifty.";
  }
  if (want.includes("-") || target.includes("-")) {
    return "Two-word numbers take a hyphen: twenty-one, fifty-five.";
  }
  return null;
}
