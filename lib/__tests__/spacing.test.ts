import assert from "node:assert/strict";
import { test } from "node:test";

import { dueAfterDays } from "@/lib/spacing";

const due = (now: string, days: number) => dueAfterDays(new Date(now), days).toISOString();

test("due dates land on the start of his day in Chicago", () => {
  // Monday 6pm CDT, and one minute before Monday midnight: both are Monday.
  assert.equal(due("2026-09-14T23:00:00.000Z", 1), "2026-09-15T05:00:00.000Z");
  assert.equal(due("2026-09-15T04:59:00.000Z", 1), "2026-09-15T05:00:00.000Z");
  // Tuesday midnight is already Tuesday.
  assert.equal(due("2026-09-15T05:00:00.000Z", 1), "2026-09-16T05:00:00.000Z");
});

test("due dates follow the clock changes", () => {
  // Clocks go back on Nov 1: midnight on Nov 2 is 6am UTC, not 5am.
  assert.equal(due("2026-10-31T23:00:00.000Z", 1), "2026-11-01T05:00:00.000Z");
  assert.equal(due("2026-10-31T23:00:00.000Z", 2), "2026-11-02T06:00:00.000Z");
  // Clocks go forward on Mar 8.
  assert.equal(due("2026-03-07T23:00:00.000Z", 1), "2026-03-08T06:00:00.000Z");
  assert.equal(due("2026-03-07T23:00:00.000Z", 2), "2026-03-09T05:00:00.000Z");
});
