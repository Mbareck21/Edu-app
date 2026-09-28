import assert from "node:assert/strict";
import test from "node:test";

import {
  DEVICE_LIMIT,
  HOME_LIMIT,
  PIN_WINDOW_MS,
  clearPinMisses,
  deviceIdFrom,
  pinWait,
  recordPinMiss,
  type PinFailures,
} from "@/lib/pin-throttle";

const IP = "203.0.113.7";
const NOW = 1_800_000_000_000;

test("one boy's misses lock his phone, not his brother's on the same wifi", () => {
  const fails: PinFailures = new Map();
  for (let i = 0; i < DEVICE_LIMIT; i++) recordPinMiss(fails, "phone-a", IP, NOW + i);
  assert.ok(pinWait(fails, "phone-a", IP, NOW + 10) > 0, "his own phone waits");
  assert.equal(pinWait(fails, "phone-b", IP, NOW + 10), 0, "his brother's phone does not");
});

test("a script that drops its cookie is still stopped by the home limit", () => {
  const fails: PinFailures = new Map();
  for (let i = 0; i < HOME_LIMIT; i++) recordPinMiss(fails, `fresh-${i}`, IP, NOW + i);
  assert.ok(pinWait(fails, "fresh-new", IP, NOW + HOME_LIMIT) > 0);
  assert.equal(pinWait(fails, "fresh-new", "198.51.100.1", NOW + HOME_LIMIT), 0, "another address is not affected");
});

test("the wait ends when the window passes, and the right PIN clears the device", () => {
  const fails: PinFailures = new Map();
  for (let i = 0; i < DEVICE_LIMIT; i++) recordPinMiss(fails, "phone-a", IP, NOW);
  const wait = pinWait(fails, "phone-a", IP, NOW + 1000);
  assert.ok(wait > 0 && wait <= PIN_WINDOW_MS / 1000);
  assert.equal(pinWait(fails, "phone-a", IP, NOW + PIN_WINDOW_MS + 1), 0);
  for (let i = 0; i < DEVICE_LIMIT - 1; i++) recordPinMiss(fails, "phone-c", IP, NOW);
  clearPinMisses(fails, "phone-c");
  recordPinMiss(fails, "phone-c", IP, NOW);
  assert.equal(pinWait(fails, "phone-c", IP, NOW), 0, "starts counting again from one");
});

test("the device id is taken from a sane cookie, otherwise made new", () => {
  const id = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
  assert.deepEqual(deviceIdFrom(id), { id, isNew: false });
  for (const bad of [undefined, "", "x", "<script>", "a".repeat(200)]) {
    const got = deviceIdFrom(bad);
    assert.equal(got.isNew, true);
    assert.match(got.id, /^[a-f0-9-]{36}$/);
  }
});
