import assert from "node:assert/strict";
import test from "node:test";

import { adultLockOn, isAdultApi, isAdultPage, isAdultToken, signAdultToken } from "@/lib/adult";

test("the lock is on only when ADULT_PIN is set", () => {
  assert.equal(adultLockOn({ ADULT_PIN: "9999" }), true);
  assert.equal(adultLockOn({}), false);
});

test("the list manager and editors are grown-up pages; flashcards are not", () => {
  assert.equal(isAdultPage("/me/lists"), true);
  assert.equal(isAdultPage("/me/lists/abc123"), true);
  assert.equal(isAdultPage("/lists/abc123"), true);
  assert.equal(isAdultPage("/lists/abc123/flashcards"), false);
  assert.equal(isAdultPage("/me"), false);
  assert.equal(isAdultPage("/"), false);
});

test("creating, editing and deleting lists need a grown-up; filling meanings does not", () => {
  assert.equal(isAdultApi("POST", "/api/lists"), true);
  assert.equal(isAdultApi("POST", "/api/lists/seed"), true);
  assert.equal(isAdultApi("PATCH", "/api/lists/abc"), true);
  assert.equal(isAdultApi("DELETE", "/api/lists/abc"), true);
  assert.equal(isAdultApi("GET", "/api/lists/abc"), false);
  assert.equal(isAdultApi("GET", "/api/lists"), false);
  assert.equal(isAdultApi("POST", "/api/lists/abc/examples"), false);
  assert.equal(isAdultApi("POST", "/api/sessions/complete"), false);
});

test("an unlock token is accepted; anything else is not", async () => {
  process.env.AUTH_SECRET ??= "test-secret-long-enough-0123456789";
  assert.equal(await isAdultToken(await signAdultToken()), true);
  assert.equal(await isAdultToken("nope"), false);
  assert.equal(await isAdultToken(undefined), false);
});
