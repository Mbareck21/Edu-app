import type { Level, MathQuestion, MathSkill, MathSkillId, PlaceName, Rng, ShapeName, Visual } from "./types";
import { pick, randInt, shuffle } from "./rng";
import { group as commas, toExpanded, toUnitForm, toWords } from "@/lib/number-words";

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

/** "an 80° angle", "a 60° angle". */
function aOrAn(n: number): string {
  const s = String(n);
  return s[0] === "8" || s === "11" || s === "18" ? "an" : "a";
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
  } else if (level === 3) {
    if (rng() < 0.5) {
      pair = carryPair(rng, 1000, 6999, 1000, 2999);
      chunkUnit = 1000;
    } else {
      pair = carryPair(rng, 10000, 69999, 10000, 29999);
      chunkUnit = 1000;
    }
  } else if (level === 4) {
    // Grade 5: hundred thousands.
    pair = carryPair(rng, 10000, 69999, 1000, 29999);
    chunkUnit = 1000;
  } else {
    // Grade 5: millions.
    pair = carryPair(rng, 100000, 699999, 10000, 299999);
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

/** Grade 5: a fact times tens, hundreds or thousands. 4 = one factor, 5 = both. */
function genMulTens(level: Level, rng: Rng): MathQuestion {
  const x = randInt(rng, 2, 12);
  const y = randInt(rng, 2, 12);
  const xZeros = level === 4 ? 0 : randInt(rng, 1, 2);
  const yZeros = level === 4 ? randInt(rng, 1, 2) : randInt(rng, 1, 3 - xZeros);
  const zeros = xZeros + yZeros;
  let a = x * Math.pow(10, xZeros);
  let b = y * Math.pow(10, yZeros);
  if (rng() < 0.5) {
    const t = a;
    a = b;
    b = t;
  }
  const answer = x * y * Math.pow(10, zeros);
  return {
    prompt: `${group(a)} × ${group(b)} = ?`,
    answer,
    visual: NONE,
    how: `${x} × ${y} = ${x * y}, then add ${zeros} ${zeros === 1 ? "zero" : "zeros"}: ${group(answer)}`,
    op: "×",
    a,
    b,
  };
}

function genMulFacts(level: Level, rng: Rng): MathQuestion {
  if (level >= 4) return genMulTens(level, rng);
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
  if (level >= 4) {
    // Grade 5: 3-digit (level 4) or 4-digit (level 5) times 2-digit.
    const a = level === 4 ? randInt(rng, 101, 999) : randInt(rng, 1001, 9999);
    const b = randInt(rng, 1, 9) * 10 + randInt(rng, 1, 9);
    const bTens = b - (b % 10);
    const bOnes = b % 10;
    return {
      prompt: `${group(a)} × ${b} = ?`,
      answer: a * b,
      visual: NONE,
      how: `Partial products: ${group(a)}×${bTens} + ${group(a)}×${bOnes} = ${group(a * bTens)} + ${group(a * bOnes)} = ${group(a * b)}`,
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
  if (level >= 4) return genDivideBy2Digit(level, rng);
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

/** Grade 5: 2-digit divisors. 4 = up to 3-digit numbers, 5 = up to 4-digit. */
function genDivideBy2Digit(level: Level, rng: Rng): MathQuestion {
  const d = level === 4 ? randInt(rng, 11, 49) : randInt(rng, 12, 99);
  const most = level === 4 ? 999 : 9999;
  const q = randInt(rng, level === 4 ? 4 : 11, Math.min(99, Math.floor((most - d) / d)));
  const whole = d * q;
  const roll = randInt(rng, 1, 3);
  if (roll === 1) {
    return {
      prompt: `${group(whole)} ÷ ${d} = ?`,
      answer: q,
      visual: NONE,
      how: `${d} × ${q} = ${group(whole)}, so ${group(whole)} ÷ ${d} = ${q}. No remainder.`,
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
      how: `${d} × ${q} = ${group(whole)}, ${r} left over. Quotient ${q}.`,
      op: "÷",
      a: n,
      b: d,
    };
  }
  return {
    prompt: `${group(n)} ÷ ${d}. How many are left over?`,
    answer: r,
    visual: NONE,
    how: `${d} × ${q} = ${group(whole)}. ${group(n)} - ${group(whole)} = ${r}. Remainder ${r}.`,
    op: "÷",
    a: n,
    b: d,
  };
}

// ---------------------------------------------------------- factors-multiples

type FactorKind = "multiple" | "count" | "missing";
const FACTOR_KINDS: readonly FactorKind[] = ["multiple", "count", "missing"];

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

/** Grade 5 fraction denominators. Neither number of a pair fits into the other. */
const COMMON_BASES: readonly number[] = [2, 3, 4, 5, 6, 8, 9, 10, 12];
const COMMON_PAIRS: readonly [number, number][] = COMMON_BASES.flatMap((x) =>
  COMMON_BASES.filter((y) => x !== y && x % y !== 0 && y % x !== 0).map((y): [number, number] => [x, y]),
);

/** The common denominator he needs to add unlike fractions. */
function commonMultiple(rng: Rng): MathQuestion {
  const [x, y] = pick(rng, COMMON_PAIRS);
  const big = Math.max(x, y);
  const small = Math.min(x, y);
  const both = lcm(x, y);
  const counted: number[] = [];
  for (let m = big; m <= both; m += big) counted.push(m);
  return {
    prompt: `What is the smallest number that is a multiple of ${x} and ${y}?`,
    answer: both,
    visual: NONE,
    how: `Count by ${big}: ${counted.join(", ")}. ${both} ÷ ${small} = ${both / small}, so ${both}.`,
    op: "?",
    a: x,
    b: y,
  };
}

/** Greatest common factor of two numbers up to 84. */
function commonFactor(rng: Rng): MathQuestion {
  const g = randInt(rng, 2, 12);
  const [m, n] = pick(rng, [
    [2, 3],
    [2, 5],
    [3, 4],
    [3, 5],
    [4, 5],
    [5, 6],
    [2, 7],
    [3, 7],
  ]);
  const x = g * m;
  const y = g * n;
  return {
    prompt: `What is the biggest number that is a factor of ${x} and ${y}?`,
    answer: g,
    visual: NONE,
    how: `Factors of both ${x} and ${y}: ${factorsOf(g).join(", ")}. The biggest is ${g}.`,
    op: "?",
    a: x,
    b: y,
  };
}

function genFactors(level: Level, rng: Rng): MathQuestion {
  if (level === 4) return commonMultiple(rng);
  if (level === 5) return rng() < 0.5 ? commonFactor(rng) : commonMultiple(rng);
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

/** Level 4: one denominator is a whole number of times the other. */
const UNLIKE_EASY = EQUIV_PAIRS.filter((p) => p.big <= 12);
/** Level 5: neither denominator fits into the other; the common one is 24 or less. */
const UNLIKE_HARD: readonly { x: number; y: number; common: number }[] = UNIT_DENS.flatMap((x) =>
  UNIT_DENS.filter((y) => y > x && y % x !== 0 && lcm(x, y) <= 24).map((y) => ({ x, y, common: lcm(x, y) })),
);

/** Grade 5: unlike denominators, fraction times a whole, and mixed numbers. */
function genFractionsG5(level: Level, rng: Rng): MathQuestion {
  if (level === 4) {
    if (rng() < 0.65) {
      const { small, big } = pick(rng, UNLIKE_EASY);
      const times = big / small;
      const x = randInt(rng, 1, small - 1);
      const top = x * times;
      if (rng() < 0.5) {
        const y = randInt(rng, 1, big - 1);
        return {
          prompt: `${x}/${small} + ${y}/${big} = ?/${big}. Type the top number.`,
          answer: top + y,
          visual: NONE,
          how: `${x}/${small} = ${top}/${big}. ${top} + ${y} = ${top + y}, so ${top + y}/${big}.`,
          op: "+",
          a: x,
          b: y,
        };
      }
      const y = randInt(rng, 1, top - 1);
      return {
        prompt: `${x}/${small} - ${y}/${big} = ?/${big}. Type the top number.`,
        answer: top - y,
        visual: NONE,
        how: `${x}/${small} = ${top}/${big}. ${top} - ${y} = ${top - y}, so ${top - y}/${big}.`,
        op: "-",
        a: x,
        b: y,
      };
    }
    const d = pick(rng, SET_DENS);
    const part = randInt(rng, 2, 10);
    const whole = d * part;
    const n = randInt(rng, 1, d - 1);
    return {
      prompt: `${n}/${d} × ${whole} = ?`,
      answer: part * n,
      visual: NONE,
      how: `${whole} ÷ ${d} = ${part}, then ${part} × ${n} = ${part * n}.`,
      op: "×",
      a: whole,
      b: d,
    };
  }

  if (rng() < 0.65) {
    const { x, y, common } = pick(rng, UNLIKE_HARD);
    const p = randInt(rng, 1, x - 1);
    const q = randInt(rng, 1, y - 1);
    const pTop = p * (common / x);
    const qTop = q * (common / y);
    const change = `${p}/${x} = ${pTop}/${common}, ${q}/${y} = ${qTop}/${common}.`;
    // Subtract only when the first is bigger; equal ones (2/4, 3/6) add instead.
    if (pTop === qTop || rng() < 0.5) {
      return {
        prompt: `${p}/${x} + ${q}/${y} = ?/${common}. Type the top number.`,
        answer: pTop + qTop,
        visual: NONE,
        how: `${change} ${pTop} + ${qTop} = ${pTop + qTop}`,
        op: "+",
        a: p,
        b: q,
      };
    }
    const [hi, lo] = pTop > qTop ? [`${p}/${x}`, `${q}/${y}`] : [`${q}/${y}`, `${p}/${x}`];
    const [hiTop, loTop] = pTop > qTop ? [pTop, qTop] : [qTop, pTop];
    return {
      prompt: `${hi} - ${lo} = ?/${common}. Type the top number.`,
      answer: hiTop - loTop,
      visual: NONE,
      how: `${change} ${hiTop} - ${loTop} = ${hiTop - loTop}`,
      op: "-",
      a: hiTop,
      b: loTop,
    };
  }
  const d = pick(rng, UNIT_DENS);
  const w1 = randInt(rng, 1, 3);
  const n1 = randInt(rng, 1, d - 1);
  const w2 = randInt(rng, 1, 3);
  const n2 = randInt(rng, 1, d - 1);
  const t1 = w1 * d + n1;
  const t2 = w2 * d + n2;
  return {
    prompt: `${w1} ${n1}/${d} + ${w2} ${n2}/${d} = ?/${d}. Type the top number.`,
    answer: t1 + t2,
    visual: NONE,
    how: `${w1} ${n1}/${d} = ${t1}/${d}, ${w2} ${n2}/${d} = ${t2}/${d}. ${t1} + ${t2} = ${t1 + t2}`,
    op: "+",
    a: t1,
    b: t2,
  };
}

function genFractions(level: Level, rng: Rng): MathQuestion {
  if (level >= 4) return genFractionsG5(level, rng);
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

const PLOT_NOUNS: readonly string[] = ["snails", "bugs", "leaves", "shells", "worms"];

/** Grade 5 line plot: how many things were each length, in fourths or eighths of an inch. */
function genLinePlot(level: Level, rng: Rng): MathQuestion {
  const d = level === 4 ? 4 : 8;
  const unitName = level === 4 ? "fourths" : "eighths";
  const tops = level === 4 ? [1, 2, 3] : [1, 3, 5, 7];
  const noun = pick(rng, PLOT_NOUNS);
  const sizes = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8]).slice(0, tops.length);
  const rows = tops.map((top, i) => ({ label: `${top}/${d}`, value: sizes[i] }));
  const visual: Visual = { kind: "bars", bars: rows, scale: 1 };
  const roll = randInt(rng, 1, 3);

  if (roll === 1) {
    const total = rows.reduce((sum, r) => sum + r.value, 0);
    return {
      prompt: `How many ${noun} were measured?`,
      answer: total,
      visual,
      how: `${rows.map((r) => r.value).join(" + ")} = ${total}`,
      op: "+",
      a: total,
    };
  }
  if (roll === 2) {
    const i = randInt(rng, 0, rows.length - 1);
    const row = rows[i];
    return {
      prompt: `Line up the ${row.label} inch ${noun} end to end. How many ${unitName} long?`,
      answer: tops[i] * row.value,
      visual,
      how: `${row.value} ${noun} × ${tops[i]} ${tops[i] === 1 ? unitName.slice(0, -1) : unitName} = ${tops[i] * row.value} ${unitName}`,
      op: "×",
      a: row.value,
      b: tops[i],
    };
  }
  const total = rows.reduce((sum, r, i) => sum + tops[i] * r.value, 0);
  return {
    prompt: `Line up all the ${noun} end to end. How many ${unitName} long?`,
    answer: total,
    visual,
    how: `${rows.map((r, i) => `${tops[i]}×${r.value}`).join(" + ")} = ${total} ${unitName}`,
    op: "+",
    a: total,
  };
}

function genData(level: Level, rng: Rng): MathQuestion {
  if (level >= 4) return genLinePlot(level, rng);
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

/** 2345 -> "2.345" (input is thousandths). */
function dec3(thousandths: number): string {
  return `${Math.floor(thousandths / 1000)}.${String(thousandths % 1000).padStart(3, "0")}`;
}

/** Grade 5: thousandths, then adding, taking away, times and sharing decimals. */
function genDecimalsG5(level: Level, rng: Rng): MathQuestion {
  const roll = randInt(rng, 1, 3);
  if (level === 4) {
    if (roll === 1) {
      const t = randInt(rng, 100, 999) * 10 + randInt(rng, 1, 9);
      const whole = Math.floor(t / 1000);
      return {
        prompt: `How many thousandths are in ${dec3(t)}?`,
        answer: t,
        visual: NONE,
        how: `${dec3(t)} = ${whole} × 1,000 + ${t % 1000} thousandths = ${group(t)} thousandths.`,
        op: "?",
        a: t,
      };
    }
    if (roll === 2) {
      const a = randInt(rng, 1, 49) * 10 + randInt(rng, 1, 9);
      const b = randInt(rng, 1, 49) * 10;
      return {
        prompt: `${dec(a)} + ${dec(b)} = ? Type hundredths.`,
        answer: a + b,
        visual: NONE,
        how: `${dec(a)} = ${a} hundredths, ${dec(b)} = ${b} hundredths. ${a} + ${b} = ${a + b}`,
        op: "+",
        a,
        b,
      };
    }
    const w = randInt(rng, 2, 9);
    const b = randInt(rng, 1, w * 10 - 1) * 10 + randInt(rng, 1, 9);
    return {
      prompt: `${w} - ${dec(b)} = ? Type hundredths.`,
      answer: w * 100 - b,
      visual: NONE,
      how: `${w} = ${w * 100} hundredths. ${w * 100} - ${b} = ${w * 100 - b}`,
      op: "-",
      a: w * 100,
      b,
    };
  }

  if (roll === 1) {
    const h = randInt(rng, 11, 99);
    const k = randInt(rng, 2, 9);
    return {
      prompt: `${dec(h)} × ${k} = ? Type hundredths.`,
      answer: h * k,
      visual: NONE,
      how: `${dec(h)} = ${h} hundredths. ${h} × ${k} = ${h * k} hundredths = ${dec(h * k)}`,
      op: "×",
      a: h,
      b: k,
    };
  }
  if (roll === 2) {
    const x = randInt(rng, 1, 9);
    const y = randInt(rng, 1, 9);
    return {
      prompt: `0.${x} × 0.${y} = ? Type hundredths.`,
      answer: x * y,
      visual: NONE,
      how: `${x} tenths × ${y} tenths = ${x * y} hundredths. So 0.${x} × 0.${y} = ${dec(x * y)}`,
      op: "×",
      a: x,
      b: y,
    };
  }
  const k = randInt(rng, 2, 9);
  const q = randInt(rng, 2, 12);
  const t = k * q;
  return {
    prompt: `${dec(t * 10)} ÷ ${k} = ? Type tenths.`,
    answer: q,
    visual: NONE,
    how: `${dec(t * 10)} = ${t} tenths. ${t} ÷ ${k} = ${q} tenths = ${dec(q * 10)}`,
    op: "÷",
    a: t,
    b: k,
  };
}

function genDecimals(level: Level, rng: Rng): MathQuestion {
  if (level >= 4) return genDecimalsG5(level, rng);
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

const BIG_PLACES: readonly string[] = ["ten thousands", "hundred thousands", "millions"];

/** Value of a digit in the ten thousands, hundred thousands or millions place. */
function pvMillions(rng: Rng): MathQuestion {
  const digits = distinctDigits(rng, 7);
  const n = fromDigits(digits);
  let from = randInt(rng, 4, 6);
  // Only one digit can be 0; the leading one never is.
  if (digits[6 - from] === 0) from = 6;
  const digit = digits[6 - from];
  const unit = Math.pow(10, from);
  return {
    prompt: `What is the value of the ${digit} in ${group(n)}?`,
    answer: digit * unit,
    visual: NONE,
    how: `The ${digit} is in the ${BIG_PLACES[from - 4]} place: ${digit} × ${group(unit)} = ${group(digit * unit)}`,
    op: "?",
    a: n,
    b: digit,
  };
}

function places(zeros: number): string {
  return zeros === 1 ? "1 place" : `${zeros} places`;
}

/** × or ÷ by 10, 100 or 1,000: every digit shifts places. */
function pvShift(rng: Rng, divide: boolean): MathQuestion {
  const x = randInt(rng, 12, 999);
  const zeros = randInt(rng, 1, 3);
  const p = Math.pow(10, zeros);
  if (divide) {
    return {
      prompt: `${group(x * p)} ÷ ${group(p)} = ?`,
      answer: x,
      visual: NONE,
      how: `÷ ${group(p)} moves each digit ${places(zeros)} right: ${group(x * p)} -> ${group(x)}`,
      op: "÷",
      a: x * p,
      b: p,
    };
  }
  return {
    prompt: `${group(x)} × ${group(p)} = ?`,
    answer: x * p,
    visual: NONE,
    how: `× ${group(p)} moves each digit ${places(zeros)} left: ${group(x)} -> ${group(x * p)}`,
    op: "×",
    a: x,
    b: p,
  };
}

/** A decimal times 100 or 1,000 lands on a whole number. */
function pvDecimalShift(rng: Rng): MathQuestion {
  const h = randInt(rng, 10, 99) * 10 + randInt(rng, 1, 9);
  const zeros = randInt(rng, 2, 3);
  const p = Math.pow(10, zeros);
  const answer = (h * p) / 100;
  return {
    prompt: `${dec(h)} × ${group(p)} = ?`,
    answer,
    visual: NONE,
    how: `× ${group(p)} moves each digit ${places(zeros)} left: ${dec(h)} -> ${group(answer)}`,
    op: "×",
    a: h,
    b: p,
  };
}

/** 7 × 10 × 10 × 10: the powers of 10 written out. */
function pvPowers(rng: Rng): MathQuestion {
  const x = randInt(rng, 2, 9);
  const tens = randInt(rng, 2, 6);
  const p = Math.pow(10, tens);
  return {
    prompt: `${x} × ${Array(tens).fill("10").join(" × ")} = ?`,
    answer: x * p,
    visual: NONE,
    how: `${Array(tens).fill("10").join(" × ")} = ${group(p)}. ${x} × ${group(p)} = ${group(x * p)}`,
    op: "×",
    a: x,
    b: p,
  };
}

function genPlaceValue(level: Level, rng: Rng): MathQuestion {
  if (level === 4) {
    const kind = randInt(rng, 1, 3);
    if (kind === 1) return pvMillions(rng);
    return pvShift(rng, kind === 3);
  }
  if (level === 5) {
    const kind = randInt(rng, 1, 3);
    if (kind === 1) return pvRound(rng, pick(rng, [10000, 100000]));
    if (kind === 2) return pvDecimalShift(rng);
    return pvPowers(rng);
  }
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

// -------------------------------------------------------------- number-forms

/**
 * The four forms his class names this week: standard, word, expanded and unit.
 *
 * Every answer here is a single whole number, because the math runner gives him
 * a number pad and nothing else. Writing the WORDS is a spelling job, so that
 * lives in the "Number Words" spelling pack instead — see lib/word-packs.ts.
 * What this skill drills is reading a form and landing on the number.
 */
function nfDigits(level: Level): { lo: number; hi: number } {
  if (level === 1) return { lo: 11, hi: 999 };
  if (level === 2) return { lo: 1000, hi: 9999 };
  return { lo: 10_000, hi: 99_999 };
}

function nfWordToStandard(level: Level, rng: Rng): MathQuestion {
  const { lo, hi } = nfDigits(level);
  const n = randInt(rng, lo, hi);
  return {
    prompt: `Write ${toWords(n)} as a number.`,
    answer: n,
    visual: NONE,
    how: `${toWords(n)} is ${commas(n)}.`,
    op: "?",
  };
}

function nfExpandedToStandard(level: Level, rng: Rng): MathQuestion {
  const { lo, hi } = nfDigits(level);
  const n = randInt(rng, lo, hi);
  return {
    prompt: `${toExpanded(n)} = ?`,
    answer: n,
    visual: NONE,
    how: `Add the parts: ${toExpanded(n)} = ${commas(n)}.`,
    op: "+",
  };
}

function nfUnitToStandard(level: Level, rng: Rng): MathQuestion {
  // Unit form spells out every place, so it grows fast. Cap it at four digits
  // to keep the prompt under the 80-character limit.
  const hi = level === 1 ? 999 : 9999;
  const n = randInt(rng, level === 1 ? 11 : 1000, hi);
  return {
    prompt: `${toUnitForm(n)} = ?`,
    answer: n,
    visual: NONE,
    how: `Each part names a place: ${toUnitForm(n)} is ${commas(n)}.`,
    op: "+",
  };
}

/** "How many tens in 340?" — the counting question unit form is really asking. */
function nfHowManyUnits(level: Level, rng: Rng): MathQuestion {
  const place = level === 1 ? 10 : pick(rng, [10, 100]);
  const name = place === 10 ? "tens" : "hundreds";
  const { lo, hi } = nfDigits(level);
  const n = Math.floor(randInt(rng, lo, hi) / place) * place;
  return {
    prompt: `How many whole ${name} are in ${commas(n)}?`,
    answer: n / place,
    visual: NONE,
    how: `${commas(n)} splits into ${n / place} ${name}.`,
    op: "÷",
    a: n,
    b: place,
  };
}

/** Grade 5 start: hundred thousands in words and parts, thousands in millions. */
function nfBig(rng: Rng): MathQuestion {
  const roll = randInt(rng, 1, 3);
  if (roll === 1) {
    // Ones part under 100 keeps the words, and the prompt, under 80 characters.
    const n = randInt(rng, 100, 999) * 1000 + randInt(rng, 0, 99);
    return {
      prompt: `Write ${toWords(n)} as a number.`,
      answer: n,
      visual: NONE,
      how: `${toWords(n)} is ${commas(n)}.`,
      op: "?",
    };
  }
  if (roll === 2) {
    const n = randInt(rng, 100_000, 999_999);
    return {
      prompt: `${toExpanded(n)} = ?`,
      answer: n,
      visual: NONE,
      how: `Add the parts: ${toExpanded(n)} = ${commas(n)}.`,
      op: "+",
    };
  }
  const n = randInt(rng, 1000, 9999) * 1000;
  return {
    prompt: `How many whole thousands are in ${commas(n)}?`,
    answer: n / 1000,
    visual: NONE,
    how: `${commas(n)} splits into ${commas(n / 1000)} thousands.`,
    op: "÷",
    a: n,
    b: 1000,
  };
}

/** Grade 5: decimals to thousandths in expanded, word and unit form. */
function nfDecimal(rng: Rng): MathQuestion {
  const roll = randInt(rng, 1, 3);
  const w = randInt(rng, 1, 9);
  const a = randInt(rng, 1, 9);
  const b = randInt(rng, 1, 9);
  const c = randInt(rng, 1, 9);
  const part = a * 100 + b * 10 + c;
  if (roll === 1) {
    return {
      prompt: `${w} + 0.${a} + 0.0${b} + 0.00${c} is how many thousandths?`,
      answer: w * 1000 + part,
      visual: NONE,
      how: `That is ${w}.${part}. ${w} × 1,000 + ${part} = ${commas(w * 1000 + part)} thousandths`,
      op: "+",
    };
  }
  if (roll === 2) {
    const k = randInt(rng, 1, 999);
    const digits = String(k).padStart(3, "0");
    return {
      prompt: `${toWords(w)} and ${toWords(k)} thousandths is how many thousandths?`,
      answer: w * 1000 + k,
      visual: NONE,
      how: `That is ${w}.${digits}. ${w} × 1,000 + ${k} = ${commas(w * 1000 + k)} thousandths`,
      op: "?",
    };
  }
  return {
    prompt: `${a} tenth${a === 1 ? "" : "s"} + ${b} hundredth${b === 1 ? "" : "s"} + ${c} thousandth${c === 1 ? "" : "s"} = ? thousandths`,
    answer: part,
    visual: NONE,
    how: `${a} × 100 + ${b} × 10 + ${c} = ${part} thousandths. That is 0.${part}`,
    op: "+",
  };
}

function genNumberForms(level: Level, rng: Rng): MathQuestion {
  if (level === 4) return nfBig(rng);
  if (level === 5) return nfDecimal(rng);
  const roll = randInt(rng, 1, 4);
  if (roll === 1) return nfWordToStandard(level, rng);
  if (roll === 2) return nfExpandedToStandard(level, rng);
  if (roll === 3) return nfUnitToStandard(level, rng);
  return nfHowManyUnits(level, rng);
}

// ------------------------------------------------------------------- geometry

/** Grade 5: volume of boxes (rectangular prisms), in unit cubes. */
function genVolume(level: Level, rng: Rng): MathQuestion {
  if (level === 4) {
    const l = randInt(rng, 2, 10);
    const w = randInt(rng, 2, 10);
    const h = randInt(rng, 2, 10);
    return {
      prompt: `A box is ${l} by ${w} by ${h}. What is the volume?`,
      answer: l * w * h,
      visual: NONE,
      how: `Volume = ${l} × ${w} × ${h} = ${l * w} × ${h} = ${l * w * h} cubic units`,
      op: "×",
      a: l * w,
      b: h,
    };
  }
  if (rng() < 0.5) {
    const l = randInt(rng, 2, 10);
    const w = randInt(rng, 2, 10);
    const h = randInt(rng, 2, 10);
    const v = l * w * h;
    return {
      prompt: `A box holds ${v} cubes. The base is ${l} by ${w}. How tall is it?`,
      answer: h,
      visual: NONE,
      how: `Base = ${l} × ${w} = ${l * w}. ${v} ÷ ${l * w} = ${h}`,
      op: "÷",
      a: v,
      b: l * w,
    };
  }
  const [a, b, c, d, e, f] = Array.from({ length: 6 }, () => randInt(rng, 2, 6));
  const v1 = a * b * c;
  const v2 = d * e * f;
  return {
    prompt: `One box is ${a} by ${b} by ${c}. Another is ${d} by ${e} by ${f}. Total volume?`,
    answer: v1 + v2,
    visual: NONE,
    how: `${a}×${b}×${c} = ${v1}. ${d}×${e}×${f} = ${v2}. ${v1} + ${v2} = ${v1 + v2} cubic units`,
    op: "+",
    a: v1,
    b: v2,
  };
}

function genGeometry(level: Level, rng: Rng): MathQuestion {
  if (level >= 4) return genVolume(level, rng);
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
    visual: { kind: "rect", w, h, label: "area", unknown: "h" },
    how: `Area ÷ one side = other side: ${area} ÷ ${w} = ${h}`,
    op: "÷",
    a: area,
    b: w,
  };
}

// --------------------------------------------------------------------- angles

/** Grade 5: angles inside shapes (4), then turns and matching angles (5). */
function genAnglesG5(level: Level, rng: Rng): MathQuestion {
  if (level === 4) {
    if (rng() < 0.5) {
      const first = randInt(rng, 4, 16) * 5;
      const second = randInt(rng, 4, 16) * 5;
      const sum = first + second;
      return {
        prompt: `A triangle has ${aOrAn(first)} ${first}° and ${aOrAn(second)} ${second}° angle. How big is the third?`,
        answer: 180 - sum,
        visual: NONE,
        how: `A triangle's angles add to 180°. ${first} + ${second} = ${sum}. 180 - ${sum} = ${180 - sum}`,
        op: "-",
        a: 180,
        b: sum,
      };
    }
    const first = randInt(rng, 12, 24) * 5;
    const third = randInt(rng, 12, 24) * 5;
    const sum = first + 90 + third;
    return {
      prompt: `A 4-sided shape has angles of ${first}°, 90° and ${third}°. The fourth?`,
      answer: 360 - sum,
      visual: NONE,
      how: `The 4 angles add to 360°. ${first} + 90 + ${third} = ${sum}. 360 - ${sum} = ${360 - sum}`,
      op: "-",
      a: 360,
      b: sum,
    };
  }
  const roll = randInt(rng, 1, 3);
  if (roll === 1) {
    const minutes = randInt(rng, 1, 11) * 5;
    return {
      prompt: `The minute hand moves ${minutes} minutes. How many degrees is that?`,
      answer: minutes * 6,
      visual: NONE,
      how: `60 minutes is 360°, so 1 minute is 6°. ${minutes} × 6 = ${minutes * 6}`,
      op: "×",
      a: minutes,
      b: 6,
    };
  }
  if (roll === 2) {
    const d = pick(rng, [4, 5, 6, 8, 10, 12]);
    const n = randInt(rng, 1, d - 1);
    const each = 360 / d;
    return {
      prompt: `How many degrees is ${n}/${d} of a full turn?`,
      answer: each * n,
      visual: NONE,
      how: `A full turn is 360°. 360 ÷ ${d} = ${each}. ${each} × ${n} = ${each * n}`,
      op: "?",
      a: n,
      b: d,
    };
  }
  const known = randInt(rng, 10, 80) * 2;
  const each = (180 - known) / 2;
  return {
    prompt: `A triangle has ${aOrAn(known)} ${known}° angle. The other 2 match. How big is each?`,
    answer: each,
    visual: NONE,
    how: `180 - ${known} = ${180 - known}. Split in 2: ${180 - known} ÷ 2 = ${each}`,
    op: "÷",
    a: 180 - known,
    b: 2,
  };
}

function genAngles(level: Level, rng: Rng): MathQuestion {
  if (level >= 4) return genAnglesG5(level, rng);
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

  // Grade 5: sort figures by their properties.
  { level: 4, name: "square", ask: "lines of symmetry", answer: 4, how: "Fold across, up and down, and on 2 diagonals: 4 lines." },
  { level: 4, name: "rectangle", ask: "lines of symmetry", answer: 2, how: "Fold across or up and down: 2 lines. Diagonals do not match." },
  { level: 4, name: "rhombus", ask: "lines of symmetry", answer: 2, how: "Fold corner to corner, 2 ways: 2 lines." },
  { level: 4, name: "parallelogram", ask: "lines of symmetry", answer: 0, how: "It leans, so no fold makes 2 halves match: 0 lines." },
  { level: 4, name: "parallelogram", ask: "pairs of equal angles", answer: 2, how: "Opposite angles match, so 2 pairs are equal." },
  { level: 4, name: "rhombus", ask: "pairs of equal angles", answer: 2, how: "A rhombus is a parallelogram: opposite angles match, 2 pairs." },
  { level: 4, name: "parallelogram", ask: "pairs of equal sides", answer: 2, how: "Opposite sides match, so 2 pairs are equal." },
  { level: 4, name: "square", ask: "diagonals", answer: 2, how: "Join each corner to the one across: 2 diagonals." },
  { level: 4, name: "rectangle", ask: "diagonals", answer: 2, how: "Every 4-sided shape has 2 diagonals." },
  { level: 4, name: "trapezoid", ask: "diagonals", answer: 2, how: "Every 4-sided shape has 2 diagonals." },
  { level: 4, name: "rhombus", ask: "diagonals", answer: 2, how: "Every 4-sided shape has 2 diagonals." },
  { level: 4, name: "right triangle", ask: "diagonals", answer: 0, how: "All 3 corners are already joined by sides: 0 diagonals." },
  { level: 4, name: "obtuse triangle", ask: "vertices", answer: 3, how: "A vertex is a corner. A triangle has 3." },
  { level: 4, name: "trapezoid", ask: "vertices", answer: 4, how: "A vertex is a corner. A trapezoid has 4." },
];

const FACTS_BY_LEVEL: Record<Exclude<Level, 5>, readonly ShapeFact[]> = {
  1: SHAPE_FACTS.filter((f) => f.level === 1),
  2: SHAPE_FACTS.filter((f) => f.level === 2),
  3: SHAPE_FACTS.filter((f) => f.level === 3),
  4: SHAPE_FACTS.filter((f) => f.level === 4),
};

function article(name: ShapeName): string {
  return "aeiou".includes(name[0]) ? "an" : "a";
}

/** Grade 5: use what a shape is to work out a side or an angle. */
function genShapeMeasures(rng: Rng): MathQuestion {
  const roll = randInt(rng, 1, 6);
  const q = (name: ShapeName, prompt: string, answer: number, how: string, op: MathQuestion["op"]): MathQuestion => ({
    prompt,
    answer,
    visual: { kind: "shape", name },
    how,
    op,
    a: answer,
  });
  if (roll <= 2) {
    const name = roll === 1 ? "square" : "rhombus";
    const side = randInt(rng, 3, 12);
    return q(
      name,
      `A ${name} has a side of ${side}. What is its perimeter?`,
      4 * side,
      `All 4 sides of a ${name} match: 4 × ${side} = ${4 * side}`,
      "×",
    );
  }
  if (roll === 3) {
    const side = randInt(rng, 3, 12);
    return q(
      "square",
      `A square has a perimeter of ${4 * side}. How long is one side?`,
      side,
      `4 equal sides: ${4 * side} ÷ 4 = ${side}`,
      "÷",
    );
  }
  if (roll === 4) {
    const x = randInt(rng, 3, 12);
    const y = randInt(rng, 3, 12);
    return q(
      "parallelogram",
      `A parallelogram has sides of ${x} and ${y}. What is its perimeter?`,
      2 * (x + y),
      `Opposite sides match: 2 × (${x} + ${y}) = ${2 * (x + y)}`,
      "+",
    );
  }
  if (roll === 5) {
    const known = randInt(rng, 8, 17) * 5;
    return q(
      "parallelogram",
      `A parallelogram has ${aOrAn(known)} ${known}° angle. How big is the angle next to it?`,
      180 - known,
      `Angles next to each other add to 180°. 180 - ${known} = ${180 - known}`,
      "-",
    );
  }
  const known = randInt(rng, 4, 14) * 5;
  return q(
    "right triangle",
    `A right triangle has a ${known}° angle. How big is the other small one?`,
    90 - known,
    `One angle is 90°, so the other 2 add to 90°. 90 - ${known} = ${90 - known}`,
    "-",
  );
}

function genShapes(level: Level, rng: Rng): MathQuestion {
  if (level === 5) return genShapeMeasures(rng);
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

/** Grade 5: bigger multi-step stories (4), 2-digit sharing and fractions of a set (5). */
function genWordProblemG5(level: Level, rng: Rng): MathQuestion {
  const kid = pick(rng, KIDS);
  const noun = pick(rng, NOUNS);
  const roll = randInt(rng, 1, 3);

  if (level === 4) {
    if (roll === 1) {
      const per = randInt(rng, 12, 48);
      const boxes = randInt(rng, 12, 40);
      return {
        prompt: `A box holds ${per} ${noun}. There are ${boxes} boxes. How many ${noun}?`,
        answer: per * boxes,
        visual: NONE,
        how: `${boxes} equal groups: ${boxes} × ${per} = ${group(per * boxes)}`,
        op: "×",
        a: boxes,
        b: per,
      };
    }
    if (roll === 2) {
      const p1 = randInt(rng, 3, 9);
      const n1 = randInt(rng, 12, 25);
      const p2 = randInt(rng, 2, 9);
      const n2 = randInt(rng, 5, 12);
      const first = p1 * n1;
      const second = p2 * n2;
      return {
        prompt: `${kid.name} buys ${p1} packs of ${n1} ${noun}. ${kid.they} buys ${p2} packs of ${n2} too. How many?`,
        answer: first + second,
        visual: NONE,
        how: `Step 1: ${p1} × ${n1} = ${first}. Step 2: ${p2} × ${n2} = ${second}. Step 3: ${first} + ${second} = ${first + second}`,
        op: "+",
        a: first,
        b: second,
      };
    }
    const friends = randInt(rng, 3, 9);
    const each = randInt(rng, 12, 40);
    const given = friends * each;
    const start = given + randInt(rng, 1, 40) * 10;
    return {
      prompt: `${kid.name} had ${start} ${noun}. ${kid.they} gave ${friends} friends ${each} each. How many left?`,
      answer: start - given,
      visual: NONE,
      how: `Step 1: ${friends} × ${each} = ${given}. Step 2: ${start} - ${given} = ${start - given}`,
      op: "-",
      a: start,
      b: given,
    };
  }

  if (roll === 1) {
    const per = randInt(rng, 12, 25);
    const boxes = randInt(rng, 12, 40);
    const total = per * boxes;
    return {
      prompt: `${total} ${noun} go in boxes of ${per}. How many boxes?`,
      answer: boxes,
      visual: NONE,
      how: `${total} ÷ ${per} = ${boxes}, because ${per} × ${boxes} = ${total}`,
      op: "÷",
      a: total,
      b: per,
    };
  }
  if (roll === 2) {
    const d = pick(rng, [2, 3, 4, 5, 6, 8, 10]);
    const n = randInt(rng, 1, d - 1);
    const part = randInt(rng, 3, 12);
    const total = d * part;
    const given = part * n;
    return {
      prompt: `${kid.name} has ${total} ${noun}. ${kid.they} gives away ${n}/${d} of them. How many left?`,
      answer: total - given,
      visual: NONE,
      how: `Step 1: ${total} ÷ ${d} = ${part}, × ${n} = ${given} given. Step 2: ${total} - ${given} = ${total - given}`,
      op: "-",
      a: total,
      b: given,
    };
  }
  const per = randInt(rng, 12, 25);
  const full = randInt(rng, 5, 30);
  const left = randInt(rng, 1, per - 1);
  const total = per * full + left;
  return {
    prompt: `Each box holds ${per} ${noun}. There are ${total}. How many full boxes?`,
    answer: full,
    visual: NONE,
    how: `${total} ÷ ${per} = ${full} with ${left} left. Only ${full} boxes are full.`,
    op: "÷",
    a: total,
    b: per,
  };
}

function genWordProblem(level: Level, rng: Rng): MathQuestion {
  if (level >= 4) return genWordProblemG5(level, rng);
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
    // Never lose more than he has: 3 bags of 8 is 24, and "loses 29" gave -5,
    // which the number pad cannot type, so the round could never end.
    const lost = randInt(rng, 5, Math.min(30, bags * per - 1));
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
    id: "number-forms",
    name: "Number Forms",
    blurb: "Read a number in words, parts or places.",
    grade: 4,
    color: "purple",
    unit: 1,
    standards: ["4.NPV.1", "4.NPV.2"],
    generate: genNumberForms,
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
