import type { Level, MathQuestion, MathSkill, MathSkillId, PlaceName, Rng, ShapeName, Visual } from "./types";
import { pick, randInt, shuffle } from "./rng";

const NONE: Visual = { kind: "none" };

/** 43207 -> "43,207". Big numbers stay readable. */
function group(n: number): string {
  const s = String(n);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return out;
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function factorsOf(n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      out.push(i);
      if (i !== n / i) out.push(n / i);
    }
  }
  return out.sort((x, y) => x - y);
}

/** 125 -> "1.25" */
function money(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** 30 -> "0.3", 45 -> "0.45" (input is hundredths). */
function dec(hundredths: number): string {
  const whole = Math.floor(hundredths / 100);
  const part = hundredths % 100;
  return part % 10 === 0 ? `${whole}.${part / 10}` : `${whole}.${String(part).padStart(2, "0")}`;
}

const PLACES: readonly PlaceName[] = ["ones", "tens", "hundreds", "thousands"];

// ---------------------------------------------------------------- add-sub-big

/** Two numbers whose ones digits carry, so regrouping is always needed. */
function carryPair(rng: Rng, aLo: number, aHi: number, bLo: number, bHi: number): { a: number; b: number } {
  const aOnes = randInt(rng, 1, 9);
  const a = randInt(rng, aLo, aHi) * 10 + aOnes;
  const bOnes = randInt(rng, 10 - aOnes, 9);
  const b = randInt(rng, bLo, bHi) * 10 + bOnes;
  return { a, b };
}

function genAddSubBig(level: Level, rng: Rng): MathQuestion {
  let pair: { a: number; b: number };
  let chunkUnit = 100;
  if (level === 1) {
    pair = carryPair(rng, 10, 44, 10, 44);
  } else if (level === 2) {
    pair = carryPair(rng, 100, 899, 10, 89);
  } else if (rng() < 0.5) {
    pair = carryPair(rng, 1000, 6999, 1000, 2999);
    chunkUnit = 1000;
  } else {
    pair = carryPair(rng, 10000, 69999, 10000, 29999);
    chunkUnit = 1000;
  }
  const { a, b } = pair;
  const sum = a + b;
  const chunk = b - (b % chunkUnit);
  const rest = b % chunkUnit;

  if (rng() < 0.5) {
    return {
      prompt: `${group(a)} + ${group(b)} = ?`,
      answer: sum,
      visual: level === 1 ? { kind: "bar", a, b } : NONE,
      how: `${group(a)} + ${group(chunk)} = ${group(a + chunk)}, + ${rest} = ${group(sum)}. Regroup the ones.`,
      op: "+",
      a,
      b,
    };
  }
  return {
    prompt: `${group(sum)} - ${group(b)} = ?`,
    answer: a,
    visual: level === 1 ? { kind: "bar", a: sum, b } : NONE,
    how: `${group(sum)} - ${group(chunk)} = ${group(sum - chunk)}, - ${rest} = ${group(a)}. Regroup.`,
    op: "-",
    a: sum,
    b,
  };
}

// ------------------------------------------------------------------ mul-facts

const EASY_TABLES: readonly number[] = [2, 3, 4, 5, 10];
const HARD_TABLES: readonly number[] = [6, 7, 8, 9];
const BIG_TABLES: readonly number[] = [11, 12];

function timesHow(a: number, b: number): string {
  if (a === 11 || a === 12) {
    return `${a} × ${b} = 10×${b} + ${a - 10}×${b} = ${10 * b} + ${(a - 10) * b} = ${a * b}`;
  }
  if (b === 11 || b === 12) {
    return `${a} × ${b} = ${a}×10 + ${a}×${b - 10} = ${a * 10} + ${a * (b - 10)} = ${a * b}`;
  }
  return `${a} × ${b} = ${a * b} (${a} groups of ${b})`;
}

function genMulFacts(level: Level, rng: Rng): MathQuestion {
  let a: number;
  let b: number;
  if (level === 1) {
    a = pick(rng, EASY_TABLES);
    b = randInt(rng, 2, 12);
  } else if (level === 2) {
    a = pick(rng, HARD_TABLES);
    b = randInt(rng, 2, 12);
  } else if (rng() < 0.6) {
    a = pick(rng, BIG_TABLES);
    b = randInt(rng, 2, 12);
  } else {
    a = randInt(rng, 3, 12);
    b = randInt(rng, 3, 12);
  }
  if (rng() < 0.5) {
    const t = a;
    a = b;
    b = t;
  }
  return {
    prompt: `${a} × ${b} = ?`,
    answer: a * b,
    visual: level === 1 ? { kind: "groups", groups: a, per: b } : NONE,
    how: timesHow(a, b),
    op: "×",
    a,
    b,
  };
}

// ------------------------------------------------------------------ mul-multi

function genMulMulti(level: Level, rng: Rng): MathQuestion {
  if (level === 1) {
    const a = randInt(rng, 1, 9) * 10 + randInt(rng, 1, 9);
    const b = randInt(rng, 3, 9);
    const tens = a - (a % 10);
    const ones = a % 10;
    return {
      prompt: `${a} × ${b} = ?`,
      answer: a * b,
      visual: NONE,
      how: `Partial products: ${b}×${tens} + ${b}×${ones} = ${b * tens} + ${b * ones} = ${a * b}`,
      op: "×",
      a,
      b,
    };
  }
  if (level === 2) {
    const a = randInt(rng, 1, 9) * 100 + randInt(rng, 1, 9) * 10 + randInt(rng, 1, 9);
    const b = randInt(rng, 3, 9);
    const h = a - (a % 100);
    const t = (a % 100) - (a % 10);
    const o = a % 10;
    return {
      prompt: `${a} × ${b} = ?`,
      answer: a * b,
      visual: NONE,
      how: `Partial products: ${b}×${h} + ${b}×${t} + ${b}×${o} = ${b * h} + ${b * t} + ${b * o} = ${a * b}`,
      op: "×",
      a,
      b,
    };
  }
  if (rng() < 0.5) {
    const a =
      randInt(rng, 1, 9) * 1000 + randInt(rng, 1, 9) * 100 + randInt(rng, 1, 9) * 10 + randInt(rng, 1, 9);
    const b = randInt(rng, 3, 9);
    const th = a - (a % 1000);
    const h = (a % 1000) - (a % 100);
    const t = (a % 100) - (a % 10);
    const o = a % 10;
    return {
      prompt: `${group(a)} × ${b} = ?`,
      answer: a * b,
      visual: NONE,
      how: `${b}×${th} + ${b}×${h} + ${b}×${t} + ${b}×${o} = ${group(a * b)}`,
      op: "×",
      a,
      b,
    };
  }
  const a = randInt(rng, 1, 9) * 10 + randInt(rng, 1, 9);
  const b = randInt(rng, 1, 9) * 10 + randInt(rng, 1, 9);
  const bTens = b - (b % 10);
  const bOnes = b % 10;
  return {
    prompt: `${a} × ${b} = ?`,
    answer: a * b,
    visual: NONE,
    how: `Partial products: ${a}×${bTens} + ${a}×${bOnes} = ${a * bTens} + ${a * bOnes} = ${group(a * b)}`,
    op: "×",
    a,
    b,
  };
}

// ------------------------------------------------------------------- division

function genDivision(level: Level, rng: Rng): MathQuestion {
  if (level === 1) {
    const d = randInt(rng, 2, 9);
    const q = randInt(rng, Math.max(2, Math.ceil(20 / d)), Math.min(49, Math.floor(99 / d)));
    const n = d * q;
    return {
      prompt: `Share ${n} into ${d} groups. How many in each?`,
      answer: q,
      visual: q <= 12 ? { kind: "groups", groups: d, per: q } : NONE,
      how: `${n} ÷ ${d} = ${q}, because ${d} × ${q} = ${n}. No remainder.`,
      op: "÷",
      a: n,
      b: d,
    };
  }
  if (level === 2) {
    const d = randInt(rng, 3, 9);
    const q = randInt(rng, 3, Math.min(12, Math.floor(98 / d)));
    const r = randInt(rng, 1, d - 1);
    const whole = d * q;
    const n = whole + r;
    if (rng() < 0.5) {
      return {
        prompt: `${n} ÷ ${d}. How many whole groups?`,
        answer: q,
        visual: NONE,
        how: `${n} ÷ ${d}: ${d} × ${q} = ${whole}, ${r} left over. Quotient ${q}.`,
        op: "÷",
        a: n,
        b: d,
      };
    }
    return {
      prompt: `${n} ÷ ${d}. How many are left over?`,
      answer: r,
      visual: NONE,
      how: `${n} ÷ ${d}: ${d} × ${q} = ${whole}. ${n} - ${whole} = ${r}. Remainder ${r}.`,
      op: "÷",
      a: n,
      b: d,
    };
  }
  // Level 3: 4-digit divided by 1-digit, with and without remainders.
  const d = randInt(rng, 3, 9);
  const q = randInt(rng, Math.ceil(1000 / d), Math.floor(9999 / d));
  const whole = d * q;
  const qHundreds = q - (q % 100);
  const qRest = q % 100;
  const roll = randInt(rng, 1, 3);
  if (roll === 1) {
    return {
      prompt: `${group(whole)} ÷ ${d} = ?`,
      answer: q,
      visual: NONE,
      how:
        qRest === 0
          ? `${d} × ${group(q)} = ${group(whole)}. No remainder.`
          : `${d} × ${group(qHundreds)} = ${group(d * qHundreds)}, ${d} × ${qRest} = ${d * qRest}. Quotient ${group(q)}.`,
      op: "÷",
      a: whole,
      b: d,
    };
  }
  const r = randInt(rng, 1, d - 1);
  const n = whole + r;
  if (roll === 2) {
    return {
      prompt: `${group(n)} ÷ ${d}. How many whole groups?`,
      answer: q,
      visual: NONE,
      how: `${d} × ${group(q)} = ${group(whole)}, ${r} left over. Quotient ${group(q)}.`,
      op: "÷",
      a: n,
      b: d,
    };
  }
  return {
    prompt: `${group(n)} ÷ ${d}. How many are left over?`,
    answer: r,
    visual: NONE,
    how: `${d} × ${group(q)} = ${group(whole)}. ${group(n)} - ${group(whole)} = ${r}. Remainder ${r}.`,
    op: "÷",
    a: n,
    b: d,
  };
}

// ---------------------------------------------------------- factors-multiples

type FactorKind = "multiple" | "count" | "missing";
const FACTOR_KINDS: readonly FactorKind[] = ["multiple", "count", "missing"];

function genFactors(level: Level, rng: Rng): MathQuestion {
  const kind = pick(rng, FACTOR_KINDS);

  if (kind === "multiple") {
    const base = level === 1 ? randInt(rng, 2, 6) : level === 2 ? randInt(rng, 2, 12) : randInt(rng, 6, 12);
    const nth = level === 1 ? randInt(rng, 2, 6) : level === 2 ? randInt(rng, 2, 12) : randInt(rng, 6, 12);
    return {
      prompt: `What is the ${ordinal(nth)} multiple of ${base}?`,
      answer: base * nth,
      visual: NONE,
      how: `Multiple ${nth} of ${base}: ${base} × ${nth} = ${base * nth}`,
      op: "×",
      a: base,
      b: nth,
    };
  }

  if (kind === "count") {
    const n = level === 1 ? randInt(rng, 6, 24) : level === 2 ? randInt(rng, 12, 48) : randInt(rng, 24, 72);
    const list = factorsOf(n);
    const pairs: string[] = [];
    for (const lo of list) {
      const hi = n / lo;
      if (lo <= hi) pairs.push(`${lo}×${hi}`);
    }
    return {
      prompt: `How many factors does ${n} have?`,
      answer: list.length,
      visual: NONE,
      how: `Factor pairs: ${pairs.join(", ")} = ${list.length} factors`,
      op: "?",
      a: n,
    };
  }

  const x = level === 1 ? randInt(rng, 2, 6) : level === 2 ? randInt(rng, 3, 10) : randInt(rng, 6, 12);
  const y = level === 1 ? randInt(rng, 2, 9) : level === 2 ? randInt(rng, 3, 12) : randInt(rng, 6, 12);
  const product = x * y;
  if (rng() < 0.5) {
    return {
      prompt: `What is missing? ${x} × ? = ${product}`,
      answer: y,
      visual: NONE,
      how: `${product} ÷ ${x} = ${y}, so the missing factor is ${y}.`,
      op: "?",
      a: x,
      b: product,
    };
  }
  return {
    prompt: `What is missing? ? × ${y} = ${product}`,
    answer: x,
    visual: NONE,
    how: `${product} ÷ ${y} = ${x}, so the missing factor is ${x}.`,
    op: "?",
    a: y,
    b: product,
  };
}

// ------------------------------------------------------------------ fractions

/** Grade-4 denominators: 2, 3, 4, 5, 6, 8, 10, 12, 100. */
const FRACTION_DENS: readonly number[] = [2, 3, 4, 5, 6, 8, 10, 12, 100];
const SET_DENS: readonly number[] = [2, 3, 4, 5, 6, 10, 12];
const UNIT_DENS: readonly number[] = [2, 3, 4, 5, 6, 8, 10, 12];

/** Pairs where the second denominator is a whole number of times the first. */
const EQUIV_PAIRS: readonly { small: number; big: number }[] = FRACTION_DENS.flatMap((small) =>
  FRACTION_DENS.filter((big) => big > small && big % small === 0).map((big) => ({ small, big })),
);

function genFractions(level: Level, rng: Rng): MathQuestion {
  if (level === 1) {
    if (rng() < 0.65) {
      const { small, big } = pick(rng, EQUIV_PAIRS);
      const times = big / small;
      const n = randInt(rng, 1, small - 1);
      return {
        prompt: `${n}/${small} = ?/${big}. Type the top number.`,
        answer: n * times,
        visual: NONE,
        how: `${small} × ${times} = ${big}, so ${n} × ${times} = ${n * times}. Equivalent: ${n * times}/${big}`,
        op: "?",
        a: n,
        b: small,
      };
    }
    const d = pick(rng, UNIT_DENS);
    const whole = randInt(rng, 1, 3);
    const n = randInt(rng, 1, d - 1);
    return {
      prompt: `How many 1/${d} make ${whole} ${n}/${d}?`,
      answer: whole * d + n,
      visual: NONE,
      how: `1 whole = ${d} unit fractions. ${whole} × ${d} = ${whole * d}, plus ${n} = ${whole * d + n}`,
      op: "?",
      a: whole,
      b: d,
    };
  }

  if (level === 2) {
    if (rng() < 0.65) {
      const d = pick(rng, FRACTION_DENS);
      const x = randInt(rng, 1, d - 2);
      const y = randInt(rng, 1, d - x);
      if (rng() < 0.5) {
        return {
          prompt: `${x}/${d} + ${y}/${d} = ?/${d}. Type the top number.`,
          answer: x + y,
          visual: NONE,
          how: `Add numerators: ${x} + ${y} = ${x + y}. Denominator stays ${d}. So ${x + y}/${d}`,
          op: "+",
          a: x,
          b: y,
        };
      }
      const big = x + y;
      return {
        prompt: `${big}/${d} - ${y}/${d} = ?/${d}. Type the top number.`,
        answer: x,
        visual: NONE,
        how: `Subtract numerators: ${big} - ${y} = ${x}. Denominator stays ${d}. So ${x}/${d}`,
        op: "-",
        a: big,
        b: y,
      };
    }
    const d = pick(rng, UNIT_DENS);
    const whole = randInt(rng, 1, 3);
    const n = randInt(rng, 1, d - 1);
    return {
      prompt: `How many 1/${d} make ${whole} ${n}/${d}?`,
      answer: whole * d + n,
      visual: NONE,
      how: `1 whole = ${d} unit fractions. ${whole} × ${d} = ${whole * d}, plus ${n} = ${whole * d + n}`,
      op: "?",
      a: whole,
      b: d,
    };
  }

  if (rng() < 0.5) {
    const d = pick(rng, SET_DENS);
    const part = randInt(rng, 2, 12);
    const whole = d * part;
    const n = randInt(rng, 1, d - 1);
    return {
      prompt: `What is ${n}/${d} of ${whole}?`,
      answer: part * n,
      visual: NONE,
      how:
        n === 1
          ? `${whole} ÷ ${d} = ${part}. So 1/${d} of ${whole} is ${part}.`
          : `${whole} ÷ ${d} = ${part}, then ${part} × ${n} = ${part * n}.`,
      op: "?",
      a: whole,
      b: d,
    };
  }
  const d = pick(rng, UNIT_DENS);
  const whole = randInt(rng, 1, 4);
  const n = randInt(rng, 1, d - 1);
  const num = whole * d + n;
  return {
    prompt: `${num}/${d} = ? wholes and ${n}/${d}`,
    answer: whole,
    visual: NONE,
    how: `${num} ÷ ${d} = ${whole} with ${n} left. So ${num}/${d} is ${whole} and ${n}/${d}.`,
    op: "?",
    a: num,
    b: d,
  };
}

// ----------------------------------------------------------------------- data

const DATA_LABELS: readonly string[] = ["Red", "Blue", "Green", "Gold"];

function genData(level: Level, rng: Rng): MathQuestion {
  const count = level === 1 ? 3 : 4;
  const labels = shuffle(rng, DATA_LABELS).slice(0, count);
  const scale = level === 1 ? 1 : pick(rng, [2, 5]);
  // Distinct sizes keep "how many more" answers away from zero.
  const sizes = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8]).slice(0, count);
  const rows = labels.map((label, i) => ({
    label,
    value: level === 1 ? sizes[i] + 2 : sizes[i] * scale,
  }));
  const visual: Visual = level === 1 ? { kind: "table", rows } : { kind: "bars", bars: rows, scale };
  const sorted = rows.slice().sort((x, y) => y.value - x.value);
  const hi = sorted[0];
  const lo = sorted[sorted.length - 1];
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const roll = randInt(rng, 1, level === 3 ? 4 : 3);

  if (roll === 1) {
    return {
      prompt: `How many kids in all?`,
      answer: total,
      visual,
      how: `${rows.map((r) => r.value).join(" + ")} = ${total}`,
      op: "+",
      a: total,
    };
  }
  if (roll === 2) {
    return {
      prompt: `How many more kids picked ${hi.label} than ${lo.label}?`,
      answer: hi.value - lo.value,
      visual,
      how: `${hi.label} is ${hi.value}, ${lo.label} is ${lo.value}. ${hi.value} - ${lo.value} = ${hi.value - lo.value}`,
      op: "-",
      a: hi.value,
      b: lo.value,
    };
  }
  if (roll === 3) {
    const second = sorted[1];
    return {
      prompt: `How many fewer kids picked ${second.label} than ${hi.label}?`,
      answer: hi.value - second.value,
      visual,
      how: `${hi.value} - ${second.value} = ${hi.value - second.value}`,
      op: "-",
      a: hi.value,
      b: second.value,
    };
  }
  const second = sorted[1];
  return {
    prompt: `${hi.label} and ${second.label} together. How many kids?`,
    answer: hi.value + second.value,
    visual,
    how: `${hi.value} + ${second.value} = ${hi.value + second.value}`,
    op: "+",
    a: hi.value,
    b: second.value,
  };
}

// ------------------------------------------------------------------- decimals

function genDecimals(level: Level, rng: Rng): MathQuestion {
  if (level === 1) {
    if (rng() < 0.5) {
      const cents = rng() < 0.5 ? randInt(rng, 1, 39) * 10 : randInt(rng, 5, 399);
      const dollars = Math.floor(cents / 100);
      const rest = cents % 100;
      return {
        prompt: `$${money(cents)} is how many cents?`,
        answer: cents,
        visual: NONE,
        how:
          dollars === 0
            ? `$${money(cents)} = ${cents} hundredths = ${cents} cents.`
            : `$${money(cents)} = ${dollars} × 100 + ${rest} = ${cents} cents.`,
        op: "?",
        a: cents,
      };
    }
    const h = randInt(rng, 1, 99);
    return {
      prompt: `${dec(h)} is how many hundredths?`,
      answer: h,
      visual: NONE,
      how: `${dec(h)} = ${h}/100, so ${h} hundredths.`,
      op: "?",
      a: h,
    };
  }

  if (level === 2) {
    const whole = randInt(rng, 1, 9);
    const tenth = randInt(rng, 0, 9);
    const value = `${whole}.${tenth}`;
    if (rng() < 0.5) {
      return {
        prompt: `How many tenths are in ${value}?`,
        answer: whole * 10 + tenth,
        visual: NONE,
        how: `${value} = ${whole} × 10 tenths + ${tenth} tenths = ${whole * 10 + tenth} tenths.`,
        op: "?",
        a: whole,
        b: tenth,
      };
    }
    return {
      prompt: `How many hundredths are in ${value}?`,
      answer: whole * 100 + tenth * 10,
      visual: NONE,
      how: `${value} = ${whole * 10 + tenth} tenths. 1 tenth = 10 hundredths, so ${whole * 100 + tenth * 10}.`,
      op: "?",
      a: whole,
      b: tenth,
    };
  }

  if (rng() < 0.5) {
    const tenths = randInt(rng, 1, 9) * 10;
    const hundredths = randInt(rng, 5, 95);
    return {
      prompt: `${dec(tenths)} + ${dec(hundredths)} = ? Type hundredths.`,
      answer: tenths + hundredths,
      visual: NONE,
      how: `${dec(tenths)} = ${tenths} hundredths. ${tenths} + ${hundredths} = ${tenths + hundredths}`,
      op: "+",
      a: tenths,
      b: hundredths,
    };
  }
  const x = randInt(rng, 5, 90) * 5;
  const y = randInt(rng, 5, 90) * 5;
  if (rng() < 0.5) {
    return {
      prompt: `$${money(x)} + $${money(y)} = ? Type it in cents.`,
      answer: x + y,
      visual: NONE,
      how: `$${money(x)} = ${x} cents, $${money(y)} = ${y} cents. ${x} + ${y} = ${x + y}`,
      op: "+",
      a: x,
      b: y,
    };
  }
  const total = x + y;
  return {
    prompt: `$${money(total)} - $${money(y)} = ? Type it in cents.`,
    answer: x,
    visual: NONE,
    how: `$${money(total)} = ${total} cents, $${money(y)} = ${y} cents. ${total} - ${y} = ${x}`,
    op: "-",
    a: total,
    b: y,
  };
}

// ---------------------------------------------------------------- place-value

function distinctDigits(rng: Rng, count: number): number[] {
  const pool = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const digits = pool.slice(0, count);
  if (digits[0] === 0) {
    digits[0] = digits[1];
    digits[1] = 0;
  }
  return digits;
}

function fromDigits(digits: readonly number[]): number {
  let n = 0;
  for (const d of digits) n = n * 10 + d;
  return n;
}

function pvDigitValue(rng: Rng, size: number): MathQuestion {
  const digits = distinctDigits(rng, size);
  const n = fromDigits(digits);
  const from = randInt(rng, 1, 3);
  const digit = digits[size - 1 - from];
  const unit = Math.pow(10, from);
  const worth = digit * unit;
  const place = PLACES[from];
  return {
    prompt: `What is the value of the ${digit} in ${group(n)}?`,
    answer: worth,
    visual: { kind: "placevalue", value: n, place },
    how: `The ${digit} is in the ${place} place: ${digit} × ${group(unit)} = ${group(worth)}`,
    op: "?",
    a: n,
    b: digit,
  };
}

function pvExpanded(rng: Rng, size: number): MathQuestion {
  const digits = distinctDigits(rng, size);
  const n = fromDigits(digits);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i++) {
    const d = digits[i];
    if (d === 0) continue;
    parts.push(group(d * Math.pow(10, digits.length - 1 - i)));
  }
  return {
    prompt: `${parts.join(" + ")} = ?`,
    answer: n,
    visual: NONE,
    how: `Expanded form: ${parts.join(" + ")} = ${group(n)}`,
    op: "+",
    a: n,
  };
}

function pvTenTimes(rng: Rng, times: number): MathQuestion {
  const digit = randInt(rng, 2, 9);
  const maxPlace = times === 10 ? 10000 : 1000;
  const places: number[] = [];
  for (let p = 10; p <= maxPlace; p *= 10) places.push(p);
  const low = digit * pick(rng, places);
  const high = low * times;
  return {
    prompt: `The ${digit} in ${group(high)} is how many times the ${digit} in ${group(low)}?`,
    answer: times,
    visual: NONE,
    how: `Each place to the left is 10 times bigger. ${group(high)} ÷ ${group(low)} = ${times}`,
    op: "?",
    a: high,
    b: low,
  };
}

function pvRound(rng: Rng, unit: number): MathQuestion {
  const n = randInt(rng, 12, 400) * unit + randInt(rng, 1, unit - 1);
  const answer = Math.floor(n / unit + 0.5) * unit;
  const next = Math.floor((n % unit) / (unit / 10));
  const way = next >= 5 ? "5 or more, so round up" : "under 5, so round down";
  return {
    prompt: `Round ${group(n)} to the nearest ${group(unit)}.`,
    answer,
    visual: NONE,
    how: `Next digit is ${next}: ${way}. ${group(n)} -> ${group(answer)}`,
    op: "?",
    a: n,
    b: unit,
  };
}

function pvCompare(rng: Rng): MathQuestion {
  const steps: readonly number[] = [1, 10, 100, 1000];
  const small = randInt(rng, 10000, 899999);
  const big = small + randInt(rng, 1, 9) * pick(rng, steps);
  const first = rng() < 0.5 ? small : big;
  const second = first === small ? big : small;
  return {
    prompt: `Which is bigger: ${group(first)} or ${group(second)}? Type it.`,
    answer: big,
    visual: NONE,
    how: `Compare place by place from the left: ${group(big)} > ${group(small)}`,
    op: "?",
    a: first,
    b: second,
  };
}

function genPlaceValue(level: Level, rng: Rng): MathQuestion {
  const roll = randInt(rng, 1, 3);
  if (level === 1) {
    if (roll === 1) return pvDigitValue(rng, 4);
    if (roll === 2) return pvExpanded(rng, 4);
    return pvTenTimes(rng, 10);
  }
  if (level === 2) {
    if (roll === 1) return pvRound(rng, pick(rng, [10, 100, 1000]));
    if (roll === 2) return pvDigitValue(rng, randInt(rng, 5, 6));
    return pvTenTimes(rng, pick(rng, [10, 100]));
  }
  if (roll === 1) return pvExpanded(rng, randInt(rng, 5, 6));
  if (roll === 2) return pvCompare(rng);
  return pvRound(rng, 1000);
}

// ------------------------------------------------------------------- geometry

function genGeometry(level: Level, rng: Rng): MathQuestion {
  if (level === 1) {
    const w = randInt(rng, 2, 12);
    const h = randInt(rng, 2, 12);
    return {
      prompt: `A rectangle is ${w} by ${h}. What is the perimeter?`,
      answer: 2 * (w + h),
      visual: { kind: "rect", w, h, label: "perimeter" },
      how: `Perimeter = 2 × (${w} + ${h}) = 2 × ${w + h} = ${2 * (w + h)}`,
      op: "+",
      a: w,
      b: h,
    };
  }
  if (level === 2) {
    const w = randInt(rng, 2, 15);
    const h = randInt(rng, 2, 15);
    return {
      prompt: `A rectangle is ${w} by ${h}. What is the area?`,
      answer: w * h,
      visual: { kind: "rect", w, h, label: "area" },
      how: `Area = ${w} × ${h} = ${w * h}`,
      op: "×",
      a: w,
      b: h,
    };
  }
  const w = randInt(rng, 2, 12);
  const h = randInt(rng, 2, 12);
  const area = w * h;
  return {
    prompt: `The area is ${area}. One side is ${w}. Find the other side.`,
    answer: h,
    visual: { kind: "rect", w, h, label: "area" },
    how: `Area ÷ one side = other side: ${area} ÷ ${w} = ${h}`,
    op: "÷",
    a: area,
    b: w,
  };
}

// --------------------------------------------------------------------- angles

function genAngles(level: Level, rng: Rng): MathQuestion {
  if (level === 1) {
    const known = randInt(rng, 2, 16) * 5;
    return {
      prompt: `A right angle is 90°. One part is ${known}°. The rest?`,
      answer: 90 - known,
      visual: { kind: "angle", total: 90, known },
      how: `The parts add up to 90°. 90 - ${known} = ${90 - known}`,
      op: "-",
      a: 90,
      b: known,
    };
  }
  if (level === 2) {
    const known = randInt(rng, 2, 34) * 5;
    return {
      prompt: `A straight angle is 180°. One part is ${known}°. The rest?`,
      answer: 180 - known,
      visual: { kind: "angle", total: 180, known },
      how: `A straight angle is 180°. 180 - ${known} = ${180 - known}`,
      op: "-",
      a: 180,
      b: known,
    };
  }
  if (rng() < 0.5) {
    const first = randInt(rng, 2, 20) * 5;
    const second = randInt(rng, 2, 20) * 5;
    return {
      prompt: `A full turn is 360°. Parts are ${first}° and ${second}°. The rest?`,
      answer: 360 - first - second,
      visual: { kind: "angle", total: 360, known: first + second },
      how: `${first} + ${second} = ${first + second}. 360 - ${first + second} = ${360 - first - second}`,
      op: "-",
      a: 360,
      b: first + second,
    };
  }
  const first = randInt(rng, 2, 16) * 5;
  const second = randInt(rng, 2, 16) * 5;
  return {
    prompt: `180° splits into ${first}°, ${second}° and ?°`,
    answer: 180 - first - second,
    visual: { kind: "angle", total: 180, known: first + second },
    how: `${first} + ${second} = ${first + second}. 180 - ${first + second} = ${180 - first - second}`,
    op: "-",
    a: 180,
    b: first + second,
  };
}

// --------------------------------------------------------------------- shapes

type ShapeFact = { level: Level; name: ShapeName; ask: string; answer: number; how: string };

const SHAPE_FACTS: readonly ShapeFact[] = [
  { level: 1, name: "rectangle", ask: "sides", answer: 4, how: "A rectangle is a quadrilateral, so it has 4 sides." },
  { level: 1, name: "square", ask: "sides", answer: 4, how: "A square is a quadrilateral, so it has 4 sides." },
  { level: 1, name: "rhombus", ask: "sides", answer: 4, how: "A rhombus is a quadrilateral, so it has 4 sides." },
  {
    level: 1,
    name: "parallelogram",
    ask: "sides",
    answer: 4,
    how: "A parallelogram is a quadrilateral, so it has 4 sides.",
  },
  { level: 1, name: "trapezoid", ask: "sides", answer: 4, how: "A trapezoid is a quadrilateral, so it has 4 sides." },
  { level: 1, name: "rectangle", ask: "right angles", answer: 4, how: "All 4 corners of a rectangle are square." },
  { level: 1, name: "square", ask: "right angles", answer: 4, how: "All 4 corners of a square are square corners." },
  { level: 1, name: "square", ask: "equal sides", answer: 4, how: "A square has 4 sides the same length." },
  { level: 1, name: "rhombus", ask: "equal sides", answer: 4, how: "A rhombus has 4 sides the same length." },
  {
    level: 1,
    name: "rectangle",
    ask: "pairs of parallel sides",
    answer: 2,
    how: "Top and bottom is 1 pair, left and right is 1 pair. 2 pairs.",
  },
  {
    level: 1,
    name: "square",
    ask: "pairs of parallel sides",
    answer: 2,
    how: "Top and bottom is 1 pair, left and right is 1 pair. 2 pairs.",
  },
  {
    level: 1,
    name: "right triangle",
    ask: "sides",
    answer: 3,
    how: "Every triangle has 3 sides and 3 angles.",
  },

  {
    level: 2,
    name: "parallelogram",
    ask: "pairs of parallel sides",
    answer: 2,
    how: "Both pairs of opposite sides are parallel. That is 2 pairs.",
  },
  {
    level: 2,
    name: "rhombus",
    ask: "pairs of parallel sides",
    answer: 2,
    how: "A rhombus is a parallelogram, so both 2 pairs are parallel.",
  },
  {
    level: 2,
    name: "trapezoid",
    ask: "pairs of parallel sides",
    answer: 1,
    how: "Only the top and bottom are parallel. That is 1 pair.",
  },
  {
    level: 2,
    name: "rectangle",
    ask: "pairs of parallel sides",
    answer: 2,
    how: "Opposite sides never meet, so 2 pairs are parallel.",
  },
  { level: 2, name: "rectangle", ask: "square corners", answer: 4, how: "A rectangle has 4 right angles." },
  { level: 2, name: "square", ask: "square corners", answer: 4, how: "A square has 4 right angles." },
  { level: 2, name: "acute triangle", ask: "sides", answer: 3, how: "Every triangle has 3 sides." },
  { level: 2, name: "obtuse triangle", ask: "sides", answer: 3, how: "Every triangle has 3 sides." },
  { level: 2, name: "right triangle", ask: "right angles", answer: 1, how: "A right triangle has exactly 1 square corner." },
  {
    level: 2,
    name: "right triangle",
    ask: "pairs of parallel sides",
    answer: 0,
    how: "Triangle sides all meet, so 0 pairs are parallel.",
  },
  {
    level: 2,
    name: "acute triangle",
    ask: "pairs of parallel sides",
    answer: 0,
    how: "Triangle sides all meet, so 0 pairs are parallel.",
  },
  { level: 2, name: "trapezoid", ask: "sides", answer: 4, how: "A trapezoid is a quadrilateral, so it has 4 sides." },

  { level: 3, name: "right triangle", ask: "right angles", answer: 1, how: "A right triangle has exactly 1 right angle." },
  { level: 3, name: "right triangle", ask: "acute angles", answer: 2, how: "1 angle is 90°, so the other 2 are acute." },
  { level: 3, name: "acute triangle", ask: "acute angles", answer: 3, how: "All 3 angles are under 90°." },
  { level: 3, name: "acute triangle", ask: "right angles", answer: 0, how: "Every angle is under 90°, so 0 right angles." },
  { level: 3, name: "acute triangle", ask: "obtuse angles", answer: 0, how: "Every angle is under 90°, so 0 obtuse angles." },
  { level: 3, name: "obtuse triangle", ask: "obtuse angles", answer: 1, how: "Only 1 angle can be more than 90°." },
  { level: 3, name: "obtuse triangle", ask: "acute angles", answer: 2, how: "1 angle is over 90°, so the other 2 are acute." },
  { level: 3, name: "obtuse triangle", ask: "right angles", answer: 0, how: "1 angle is over 90°, so 0 angles are right." },
  {
    level: 3,
    name: "trapezoid",
    ask: "pairs of parallel sides",
    answer: 1,
    how: "A trapezoid has 1 pair of parallel sides.",
  },
  {
    level: 3,
    name: "parallelogram",
    ask: "pairs of parallel sides",
    answer: 2,
    how: "A parallelogram has 2 pairs of parallel sides.",
  },
  { level: 3, name: "rhombus", ask: "equal sides", answer: 4, how: "All 4 sides of a rhombus are the same length." },
  { level: 3, name: "square", ask: "equal sides", answer: 4, how: "All 4 sides of a square are the same length." },
  { level: 3, name: "square", ask: "right angles", answer: 4, how: "A square has 4 right angles." },
  { level: 3, name: "rectangle", ask: "pairs of equal sides", answer: 2, how: "Opposite sides match, so 2 pairs are equal." },
];

const FACTS_BY_LEVEL: Record<Level, readonly ShapeFact[]> = {
  1: SHAPE_FACTS.filter((f) => f.level === 1),
  2: SHAPE_FACTS.filter((f) => f.level === 2),
  3: SHAPE_FACTS.filter((f) => f.level === 3),
};

function article(name: ShapeName): string {
  return "aeiou".includes(name[0]) ? "an" : "a";
}

function genShapes(level: Level, rng: Rng): MathQuestion {
  const fact = pick(rng, FACTS_BY_LEVEL[level]);
  return {
    prompt: `How many ${fact.ask} does ${article(fact.name)} ${fact.name} have?`,
    answer: fact.answer,
    visual: { kind: "shape", name: fact.name },
    how: fact.how,
    op: "?",
    a: fact.answer,
  };
}

// -------------------------------------------------------------- word-problems

type Kid = { name: string; they: string };
const KIDS: readonly Kid[] = [
  { name: "Sam", they: "He" },
  { name: "Mia", they: "She" },
  { name: "Ali", they: "He" },
  { name: "Zoe", they: "She" },
  { name: "Max", they: "He" },
];
const NOUNS: readonly string[] = ["apples", "stickers", "marbles", "cars", "cookies"];

function genWordProblem(level: Level, rng: Rng): MathQuestion {
  const kid = pick(rng, KIDS);
  const noun = pick(rng, NOUNS);
  const roll = randInt(rng, 1, level === 3 ? 4 : 3);

  if (level === 1) {
    if (roll === 1) {
      const a = randInt(rng, 120, 640);
      const b = randInt(rng, 105, 350);
      return {
        prompt: `${kid.name} has ${a} ${noun}. ${kid.they} gets ${b} more. How many now?`,
        answer: a + b,
        visual: { kind: "bar", a, b },
        how: `More means add: ${a} + ${b} = ${a + b}`,
        op: "+",
        a,
        b,
      };
    }
    if (roll === 2) {
      const a = randInt(rng, 300, 900);
      const b = randInt(rng, 105, 290);
      return {
        prompt: `${kid.name} had ${a} ${noun}. ${kid.they} gave away ${b}. How many left?`,
        answer: a - b,
        visual: { kind: "bar", a, b },
        how: `Gave away means subtract: ${a} - ${b} = ${a - b}`,
        op: "-",
        a,
        b,
      };
    }
    const boxes = randInt(rng, 3, 9);
    const per = randInt(rng, 12, 40);
    return {
      prompt: `${boxes} boxes have ${per} ${noun} each. How many in all?`,
      answer: boxes * per,
      visual: NONE,
      how: `${boxes} equal groups: ${boxes} × ${per} = ${boxes * per}`,
      op: "×",
      a: boxes,
      b: per,
    };
  }

  if (level === 2) {
    if (roll === 1) {
      const start = randInt(rng, 20, 90);
      const packs = randInt(rng, 2, 8);
      const per = randInt(rng, 4, 12);
      return {
        prompt: `${kid.name} has ${start} ${noun}. ${kid.they} buys ${packs} packs of ${per}. How many now?`,
        answer: start + packs * per,
        visual: NONE,
        how: `Step 1: ${packs} × ${per} = ${packs * per}. Step 2: ${start} + ${packs * per} = ${start + packs * per}`,
        op: "+",
        a: packs,
        b: per,
      };
    }
    if (roll === 2) {
      const start = randInt(rng, 150, 400);
      const first = randInt(rng, 20, 70);
      const second = randInt(rng, 20, 70);
      return {
        prompt: `${kid.name} had ${start} ${noun}. ${kid.they} sold ${first} and ${second}. How many left?`,
        answer: start - first - second,
        visual: NONE,
        how: `Step 1: ${start} - ${first} = ${start - first}. Step 2: ${start - first} - ${second} = ${start - first - second}`,
        op: "-",
        a: first,
        b: second,
      };
    }
    const bags = randInt(rng, 3, 9);
    const per = randInt(rng, 8, 20);
    const lost = randInt(rng, 5, 30);
    return {
      prompt: `${kid.name} has ${bags} bags of ${per} ${noun}. ${kid.they} loses ${lost}. How many left?`,
      answer: bags * per - lost,
      visual: NONE,
      how: `Step 1: ${bags} × ${per} = ${bags * per}. Step 2: ${bags * per} - ${lost} = ${bags * per - lost}`,
      op: "-",
      a: bags,
      b: per,
    };
  }

  if (roll === 1) {
    const boxes = randInt(rng, 3, 9);
    const per = randInt(rng, 4, 12);
    const want = randInt(rng, 2, boxes - 1);
    const total = boxes * per;
    return {
      prompt: `${total} ${noun} fill ${boxes} boxes. How many are in ${want} boxes?`,
      answer: per * want,
      visual: NONE,
      how: `Step 1: ${total} ÷ ${boxes} = ${per}. Step 2: ${per} × ${want} = ${per * want}`,
      op: "÷",
      a: total,
      b: boxes,
    };
  }
  if (roll === 2) {
    const bags = randInt(rng, 3, 9);
    const per = randInt(rng, 6, 20);
    const total = bags * per;
    return {
      prompt: `${kid.name} splits ${total} ${noun} into ${bags} bags. How many in each?`,
      answer: per,
      visual: NONE,
      how: `Equal shares: ${total} ÷ ${bags} = ${per}. No remainder.`,
      op: "÷",
      a: total,
      b: bags,
    };
  }
  if (roll === 3) {
    const packs = randInt(rng, 2, 9);
    const per = randInt(rng, 4, 12);
    const total = packs * per;
    const boxes = pick(
      rng,
      factorsOf(total).filter((f) => f >= 2 && f <= 9),
    );
    return {
      prompt: `${packs} packs of ${per} ${noun} go in ${boxes} boxes. How many each?`,
      answer: total / boxes,
      visual: NONE,
      how: `Step 1: ${packs} × ${per} = ${total}. Step 2: ${total} ÷ ${boxes} = ${total / boxes}`,
      op: "÷",
      a: total,
      b: boxes,
    };
  }
  // Remainder interpretation: the leftovers still need a box.
  const per = randInt(rng, 4, 9);
  const full = randInt(rng, 3, 12);
  const left = randInt(rng, 1, per - 1);
  const total = per * full + left;
  return {
    prompt: `Each box holds ${per} ${noun}. There are ${total}. How many boxes?`,
    answer: full + 1,
    visual: NONE,
    how: `${total} ÷ ${per} = ${full} with ${left} left. The last ${left} need a box, so ${full + 1}.`,
    op: "÷",
    a: total,
    b: per,
  };
}

// ------------------------------------------------------------------- registry

/** Ordered the way the school year teaches them (see MATH_UNITS). */
export const MATH_SKILLS: readonly MathSkill[] = [
  {
    id: "place-value",
    name: "Place Value",
    blurb: "Know what each digit is worth.",
    grade: 4,
    color: "purple",
    unit: 1,
    standards: ["4.NPV.1", "4.NPV.2"],
    generate: genPlaceValue,
  },
  {
    id: "add-sub-big",
    name: "Big Numbers",
    blurb: "Add and take away big numbers.",
    grade: 4,
    color: "purple",
    unit: 1,
    standards: ["4.CAR.2"],
    generate: genAddSubBig,
  },
  {
    id: "mul-facts",
    name: "Times Facts",
    blurb: "Know your times tables fast.",
    grade: 4,
    color: "purple",
    unit: 2,
    standards: ["4.CAR.3"],
    generate: genMulFacts,
  },
  {
    id: "mul-multi",
    name: "Big Times",
    blurb: "Times big numbers part by part.",
    grade: 4,
    color: "purple",
    unit: 2,
    standards: ["4.CAR.3"],
    generate: genMulMulti,
  },
  {
    id: "word-problems",
    name: "Word Math",
    blurb: "Read the story, then solve it.",
    grade: 4,
    color: "purple",
    unit: 2,
    standards: ["4.CAR.8"],
    generate: genWordProblem,
  },
  {
    id: "division",
    name: "Divide",
    blurb: "Split numbers into fair groups.",
    grade: 4,
    color: "purple",
    unit: 3,
    standards: ["4.CAR.4"],
    generate: genDivision,
  },
  {
    id: "factors-multiples",
    name: "Factors",
    blurb: "Find factors and multiples.",
    grade: 4,
    color: "purple",
    unit: 3,
    standards: [],
    generate: genFactors,
  },
  {
    id: "fractions",
    name: "Fractions",
    blurb: "Work with parts of a whole.",
    grade: 4,
    color: "purple",
    unit: 4,
    standards: ["4.NPV.7"],
    generate: genFractions,
  },
  {
    id: "data",
    name: "Charts",
    blurb: "Read tables and bar graphs.",
    grade: 4,
    color: "purple",
    unit: 4,
    standards: ["4.DA.1"],
    generate: genData,
  },
  {
    id: "decimals",
    name: "Money Math",
    blurb: "Use money to learn decimals.",
    grade: 4,
    color: "purple",
    unit: 5,
    standards: [],
    generate: genDecimals,
  },
  {
    id: "geometry",
    name: "Rectangles",
    blurb: "Find area and perimeter.",
    grade: 4,
    color: "purple",
    unit: 6,
    standards: [],
    generate: genGeometry,
  },
  {
    id: "angles",
    name: "Angles",
    blurb: "Add and split angles.",
    grade: 4,
    color: "purple",
    unit: 6,
    standards: ["4.GM.3"],
    generate: genAngles,
  },
  {
    id: "shapes",
    name: "Shapes",
    blurb: "Sides, corners and angles.",
    grade: 4,
    color: "purple",
    unit: 6,
    standards: ["4.GM.5"],
    generate: genShapes,
  },
];

export const MATH_SKILL_IDS: readonly MathSkillId[] = MATH_SKILLS.map((s) => s.id);

export function getSkill(id: MathSkillId): MathSkill {
  const found = MATH_SKILLS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown math skill: ${id}`);
  return found;
}

export function isMathSkillId(id: string): id is MathSkillId {
  return MATH_SKILLS.some((s) => s.id === id);
}

/** Skills the school unit covers, in display order. */
export function skillsForUnit(unit: number): MathSkill[] {
  return MATH_SKILLS.filter((s) => s.unit === unit);
}
