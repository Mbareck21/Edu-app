import { applyReading, emptyProfile, nextReadingLevel, readTooFast, MAX_READ_WPM, READING_UP_PCT, READING_UP_RUN } from "@/lib/rewards";
import { lexileForLevel, levelAtGrade, atGradeLevel, readingParams, questionPlan, planQuarter, GRADE4_LEXILE } from "@/lib/reading";
import type { ProfileState } from "@/lib/types";

console.log("UP", READING_UP_PCT, READING_UP_RUN, "GRADE4 min", GRADE4_LEXILE.min, "levelAtGrade", levelAtGrade());
for (let l = 1; l <= 12; l++) {
  const p = readingParams(l);
  console.log(`L${l} ${lexileForLevel(l)}L atGrade=${atGradeLevel(l)} words=${p.targetWords} (${p.minWords}-${p.maxWords}) maxSent=${p.maxSentenceWords} budget=${p.unknownBudget} paras=${p.paragraphs} skimFloorSec=${Math.round(p.targetWords / MAX_READ_WPM * 60)}`);
}

const START = Date.parse("2026-10-05T22:00:00Z"); // 5pm Chicago
const DAY = 86_400_000;
function read(p: ProfileState, day: number, pct: number, level = p.reading.level, offsetMs = 0): ProfileState {
  const at = new Date(START + day * DAY + offsetMs);
  return applyReading(p, { level, pct, wordsCount: 150 }, { at, today: at.toISOString().slice(0, 10) });
}

// Best case: 100% every day, one reading a day.
{
  let p = emptyProfile();
  const hit: Record<number, number> = {};
  for (let d = 0; d < 60; d++) {
    p = read(p, d, 100);
    if (!(p.reading.level in hit)) hit[p.reading.level] = d + 1;
  }
  console.log("BEST CASE readings (=days at 1/day) to reach level:", JSON.stringify(hit));
}

// What breaks a run
function seq(label: string, steps: { pct: number; level?: number; sameDay?: boolean }[], start?: ProfileState) {
  let p = start ?? emptyProfile();
  let d = 0; const trace: string[] = [];
  for (const s of steps) {
    p = read(p, d, s.pct, s.level ?? p.reading.level, s.sameDay ? 3600_000 : 0);
    trace.push(`${s.pct}@L${s.level ?? "cur"}->L${p.reading.level}`);
    if (!s.sameDay) d++;
  }
  console.log(label, trace.join("  "));
  return p;
}
seq("one 67 in the middle:", [{ pct: 100 }, { pct: 100 }, { pct: 67 }, { pct: 100 }, { pct: 100 }, { pct: 100 }]);
seq("alternating G G B:", [100, 100, 60, 100, 100, 60, 100, 100, 60].map((pct) => ({ pct })));
seq("two readings same day (replay/unlocked):", [{ pct: 100 }, { pct: 100, sameDay: true }, { pct: 100, sameDay: true }]);
// At L2 with since, a cached L1 passage read
const atL2 = seq("to L2:", [{ pct: 100 }, { pct: 100 }, { pct: 100 }]);
seq("L2: G, G, old-L1 passage 50, G:", [{ pct: 100 }, { pct: 100 }, { pct: 50, level: 1 }, { pct: 100 }], atL2);
seq("L2: G, G, old-L1 passage 100 (does it count?), then G:", [{ pct: 100 }, { pct: 100 }, { pct: 100, level: 1 }, { pct: 100 }], atL2);
seq("L2: G, G, a pinned L5 passage 100, G, G, G:", [{ pct: 100 }, { pct: 100 }, { pct: 100, level: 5 }, { pct: 100 }, { pct: 100 }, { pct: 100 }], atL2);
// profile with level set but no `since` (e.g. set by hand in DB)
const hand: ProfileState = { ...emptyProfile(), reading: { level: 3, recent: [] } };
seq("L3 no since: G, G, L1 passage 100, G:", [{ pct: 100 }, { pct: 100 }, { pct: 100, level: 1 }, { pct: 100 }, { pct: 100 }, { pct: 100 }], hand);
seq("two <50 step down:", [{ pct: 40 }, { pct: 40 }], atL2);
console.log("skim: 110 words in 21s", readTooFast({ ms: 21_000, reading: { level: 1, pct: 100, wordsCount: 110 } }), "23s", readTooFast({ ms: 23_000, reading: { level: 1, pct: 100, wordsCount: 110 } }));
console.log("nextReadingLevel sanity", nextReadingLevel(1, [], undefined, 4));

// Monte Carlo: good day (>=75) with prob pGood, else 60. One reading a day; plays on playDays of 7.
function mulberry(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function mc(label: string, pGood: number, playProb: number, badPct = 60, runs = 4000) {
  const rng = mulberry(42);
  const res: Record<number, number[]> = { 4: [], 7: [], 10: [] };
  for (let r = 0; r < runs; r++) {
    let p = emptyProfile();
    const hit: Record<number, number> = {};
    for (let d = 0; d < 220; d++) {
      if (rng() >= playProb) continue;
      p = read(p, d, rng() < pGood ? 100 : badPct);
      for (const t of [4, 7, 10]) if (p.reading.level >= t && !(t in hit)) hit[t] = d + 1;
      if (hit[10]) break;
    }
    for (const t of [4, 7, 10]) res[t].push(hit[t] ?? 999);
  }
  const stat = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return `median ${s[Math.floor(s.length / 2)]} p90 ${s[Math.floor(s.length * 0.9)]} mean ${Math.round(s.reduce((a, b) => a + b, 0) / s.length)}`; };
  console.log(label, "| L4:", stat(res[4]), "| L7:", stat(res[7]), "| L10:", stat(res[10]));
}
mc("80% good, plays every day      ", 0.8, 1);
mc("80% good, plays 5 of 7 days    ", 0.8, 5 / 7);
mc("100% good, plays 5 of 7 days   ", 1, 5 / 7);
mc("67% good, plays every day      ", 0.67, 1);
mc("80% good, bad day = 40 (every) ", 0.8, 1, 40);

// Per-question model with the REAL question counts: P(first try) pm for mcq, pt for typed
function binomAtLeast(n: number, k: number, p: number) { let s = 0; const C = (n: number, r: number) => { let c = 1; for (let i = 0; i < r; i++) c = (c * (n - i)) / (i + 1); return c; }; for (let i = k; i <= n; i++) s += C(n, i) * p ** i * (1 - p) ** (n - i); return s; }
console.log("\nQuestion counts by level (today 2026-11-16, planQuarter=", planQuarter("2026-11-16"), ")");
for (const q of ["Q2", "Q3"] as const) for (const opens of [[], ["evidence"]] as const) {
  console.log(`-- quarter ${q}, report-card opens ${JSON.stringify(opens)}`);
  for (const l of [1, 3, 4, 5, 7, 10]) {
    const row: string[] = [];
    for (const [kind, sci] of [["story", false], ["info", true], ["info", false]] as const) {
      const plan = questionPlan(l, kind, sci, q, opens as any);
      const n = plan.length; const typed = plan.filter((s) => s.format === "text").length;
      const need = Math.ceil(0.745 * n); // pct rounded >= 75
      let k = 0; while (Math.round((k / n) * 100) < 75) k++;
      // P(good) with mcq p=.85, typed p=.5
      const m = n - typed; let pg = 0;
      for (let tr = 0; tr <= typed; tr++) { const pt = typed ? (tr ? 0.5 : 0.5) : 1; pg += pt * binomAtLeast(m, Math.max(0, k - tr), 0.85); }
      row.push(`${kind}${sci ? "+sci" : ""}: n=${n} typed=${typed} need ${k}/${n} (${Math.round((k / n) * 100)}%, one miss=${Math.round(((n - 1) / n) * 100)}%, two=${Math.round(((n - 2) / n) * 100)}%) P(good|.85mcq,.5typed)=${pg.toFixed(2)}`);
    }
    console.log(`L${l}: ` + row.join(" | "));
  }
}
for (let n = 2; n <= 7; n++) { const o = []; for (let k = 0; k <= n; k++) o.push(Math.round((k / n) * 100)); console.log(`n=${n}: pcts ${o.join("/")}`); }
