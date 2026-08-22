import assert from "node:assert/strict";
import test from "node:test";

import {
  ELA_STANDARDS,
  FPS_QUARTERS,
  LATIN_PARTS,
  READING_THEMES,
  SCIENCE_UNITS,
  THEME_WEEKS,
  currentQuarter,
  scienceUnitForWeek,
  isLaunchWeek,
  isReviewWeek,
  themeForWeek,
  weekInTheme,
} from "@/lib/curriculum";

function addDays(dateISO: string, n: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

test("theme walk is monotonic across the school year", () => {
  const order = new Map(READING_THEMES.map((t, i) => [t.id, i]));
  const seen = new Set<string>();
  let prev = -1;
  for (let day = "2026-08-11"; day <= "2027-05-20"; day = addDays(day, 1)) {
    const idx = order.get(themeForWeek(day).id);
    assert.ok(idx !== undefined);
    // Units run in order until the publisher's 33 weeks are used up; after
    // that the year cycles back through them for Q4 review, which is the one
    // place the index is allowed to drop.
    if (!isReviewWeek(day)) {
      assert.ok(idx >= prev, `theme went backwards on ${day}: ${idx} after ${prev}`);
      prev = idx;
    }
    seen.add(themeForWeek(day).id);
  }
  assert.equal(themeForWeek("2026-08-11").id, READING_THEMES[0].id);
  assert.equal(prev, READING_THEMES.length - 1, "the units run all the way through");
  assert.equal(seen.size, READING_THEMES.length, "every theme should get at least one week");
});

test("themes are complete", () => {
  assert.equal(READING_THEMES.length, 10);
  for (const t of READING_THEMES) {
    assert.ok(t.words.length >= 8 && t.words.length <= 12, `${t.id} words: ${t.words.length}`);
    assert.ok(t.prompts.length >= 2 && t.prompts.length <= 3, `${t.id} prompts`);
  }
});

test("every ELA standard has at least one item type", () => {
  assert.ok(ELA_STANDARDS.length > 0);
  for (const s of ELA_STANDARDS) {
    assert.ok(s.itemTypes.length >= 1, `${s.code} has no item type`);
    assert.ok(s.quarters.length >= 1, `${s.code} has no quarter`);
    assert.ok(s.plain.length > 20, `${s.code} plain wording too short`);
  }
});

test("quarters are ordered and add up", () => {
  const ids = FPS_QUARTERS.map((q) => q.id);
  assert.deepEqual(ids, ["Q1", "Q2", "Q3", "Q4"]);
  assert.equal(FPS_QUARTERS.reduce((n, q) => n + q.days, 0), 174);
  for (let i = 1; i < FPS_QUARTERS.length; i++) {
    assert.ok(FPS_QUARTERS[i].start > FPS_QUARTERS[i - 1].end);
  }
  assert.equal(currentQuarter("2026-09-01"), "Q1");
  assert.equal(currentQuarter("2026-12-25"), "summer");
  assert.equal(currentQuarter("2027-03-12"), "Q4");
  assert.equal(currentQuarter("2027-07-04"), "summer");
});

test("latin parts cover prefixes, suffixes and bases", () => {
  assert.ok(LATIN_PARTS.length >= 30);
  for (const kind of ["prefix", "suffix", "base"] as const) {
    assert.ok(LATIN_PARTS.some((p) => p.kind === kind), `no ${kind}`);
  }
  for (const p of LATIN_PARTS) {
    assert.ok(p.examples.length >= 2, `${p.part} needs examples`);
    assert.ok(p.meaning.length > 2, `${p.part} needs a meaning`);
  }
});

test("science units have enough words and monotonic weeks", () => {
  for (const u of SCIENCE_UNITS) {
    assert.ok(u.words.length >= 12, `${u.id} has ${u.words.length} words`);
    assert.ok(u.passageIdeas.length >= 4, `${u.id} passage ideas`);
    assert.ok(u.weekStart <= u.weekEnd, `${u.id} week range`);
  }
  for (let i = 1; i < SCIENCE_UNITS.length; i++) {
    assert.ok(
      SCIENCE_UNITS[i].weekStart >= SCIENCE_UNITS[i - 1].weekStart,
      `unit ${SCIENCE_UNITS[i].id} starts before the one before it`,
    );
  }
});

test("science unit lookup follows the week calendar", () => {
  assert.equal(scienceUnitForWeek("2026-08-11")?.id, undefined); // week 1: no unit yet
  assert.equal(scienceUnitForWeek("2026-08-18")?.id, "adaptations"); // week 2
  assert.equal(scienceUnitForWeek("2026-09-22")?.id, "senses"); // week 7
  assert.equal(scienceUnitForWeek("2026-11-03")?.id, "earth-features");
  assert.equal(scienceUnitForWeek("2027-01-12")?.id, "energy");
  assert.equal(scienceUnitForWeek("2027-03-16")?.id, "waves");
  assert.equal(scienceUnitForWeek("2027-04-06")?.id, "engineering-design");
  // weeks are counted through the breaks, so the tail of the year stays on the last unit
  assert.equal(scienceUnitForWeek("2027-05-20")?.id, "engineering-design");
  assert.equal(scienceUnitForWeek("2026-07-01"), null);
  assert.equal(scienceUnitForWeek("2027-06-30"), null);
});

test("the reading year follows the publisher's plan", () => {
  // Three launch weeks, then Unit 1.
  assert.ok(isLaunchWeek("2026-08-11"));
  assert.ok(isLaunchWeek("2026-08-25"));
  assert.ok(!isLaunchWeek("2026-09-01"));
  assert.equal(themeForWeek("2026-09-01").schoolTitle, "In the Wild");

  // Each unit runs exactly three weeks, in order, with no gaps.
  const seen: string[] = [];
  let d = Date.UTC(2026, 7, 31);
  for (let i = 0; i < 30; i++) {
    const iso = new Date(d).toISOString().slice(0, 10);
    const w = weekInTheme(iso);
    assert.ok(w >= 1 && w <= THEME_WEEKS, `${iso} -> ${w}`);
    assert.ok(!isReviewWeek(iso), `${iso} is still a unit week`);
    const id = themeForWeek(iso).id;
    if (seen[seen.length - 1] !== id) seen.push(id);
    d += 7 * 86_400_000;
  }
  // Winter break weeks repeat a week rather than advancing, so the ten units
  // may not all be reached inside 30 calendar weeks — but the order holds.
  assert.deepEqual(
    seen,
    READING_THEMES.slice(0, seen.length).map((t) => t.id),
    "units run in publisher order"
  );

  // Every unit carries the name his school uses.
  for (const t of READING_THEMES) assert.ok(t.schoolTitle.length > 0, t.id);
});

test("leftover weeks cycle back through the units for review", () => {
  const late = "2027-04-12";
  assert.ok(isReviewWeek(late));
  assert.equal(themeForWeek(late).id, READING_THEMES[0].id);
  assert.equal(themeForWeek("2027-04-19").id, READING_THEMES[1].id);
});
