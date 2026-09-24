import { test } from "node:test";
import assert from "node:assert/strict";

import { learnerForPin, learnerFromCookie, ownerOf } from "../learners";

const env = { PARENT_PIN: "1234", WISSAM_PIN: "2026" };

test("each PIN signs in its own child", () => {
  assert.equal(learnerForPin("1234", env), "nour");
  assert.equal(learnerForPin("2026", env), "wissam");
  assert.equal(learnerForPin("0000", env), null);
});

test("an unset PIN signs in nobody, even an empty guess", () => {
  assert.equal(learnerForPin("", { PARENT_PIN: "1234" }), null);
  assert.equal(learnerForPin("2026", { PARENT_PIN: "1234" }), null);
});

test("anything with no owner is Nour's", () => {
  assert.equal(ownerOf(""), "nour");
  assert.equal(ownerOf(undefined), "nour");
  assert.equal(ownerOf("wissam"), "wissam");
  assert.equal(ownerOf("someone"), "nour");
});

test("the label cookie names the child, and nothing else does", () => {
  assert.equal(learnerFromCookie("a=1; eduapp_learner=wissam; b=2"), "wissam");
  assert.equal(learnerFromCookie("eduapp_learner=nour"), "nour");
  assert.equal(learnerFromCookie("eduapp_learner=someone"), null);
  assert.equal(learnerFromCookie("x_eduapp_learner=nour"), null);
  assert.equal(learnerFromCookie(""), null);
});
