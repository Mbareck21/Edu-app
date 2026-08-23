import assert from "node:assert/strict";
import { test } from "node:test";

import { IDLE_GAP_MS, startStopwatch } from "@/lib/time-on-task";

function fakeClock(start = 1_000) {
  let t = start;
  return { now: () => t, tick: (ms: number) => { t += ms; } };
}

test("steady work adds up exactly", () => {
  const c = fakeClock();
  const sw = startStopwatch(c.now);
  c.tick(3000);
  sw.mark();
  c.tick(4000);
  sw.mark();
  assert.equal(sw.read(), 7000);
});

test("read() counts the gap since the last mark", () => {
  const c = fakeClock();
  const sw = startStopwatch(c.now);
  c.tick(2500);
  assert.equal(sw.read(), 2500);
  assert.equal(sw.read(), 2500, "read does not consume the gap");
});

test("a walk-away is capped, and work after it still counts", () => {
  const c = fakeClock();
  const sw = startStopwatch(c.now);
  c.tick(9_000_000); // the 2.5-hour reading in his real data
  sw.mark();
  c.tick(5000);
  sw.mark();
  assert.equal(sw.read(), IDLE_GAP_MS + 5000);
});

test("many idle gaps stay bounded by the work he did", () => {
  const c = fakeClock();
  const sw = startStopwatch(c.now);
  for (let i = 0; i < 10; i++) {
    c.tick(60 * 60 * 1000);
    sw.mark();
  }
  assert.equal(sw.read(), 10 * IDLE_GAP_MS);
});

test("a clock that goes backwards never subtracts time", () => {
  let t = 5000;
  const sw = startStopwatch(() => t);
  t = 4000;
  assert.equal(sw.read(), 0);
});
