import assert from "node:assert/strict";
import { test } from "node:test";

import { SCROLL_MARGIN, needsScroll } from "@/lib/scroll-into-view";

/**
 * Measured on a 276-word level 10 passage at 375x812 on 2026-09-01: the answer
 * box sat at y=1748 with the page at scrollY 0, so tapping "Answer the
 * questions" appeared to do nothing. In listen mode paragraphs 3 and 4 began
 * at y=899 and y=1278, so the paragraph being read aloud lit up off-screen.
 */

const VIEW = 812;

test("something already on screen is left alone", () => {
  // Moving the page under him when he can already see the thing is worse than
  // the problem: he loses his place mid-read.
  assert.equal(needsScroll(200, 400, VIEW), false);
  assert.equal(needsScroll(SCROLL_MARGIN, VIEW - SCROLL_MARGIN, VIEW), false);
});

test("the question two screens down is scrolled to", () => {
  // The real measurement: the answer box at 1748 on an 812 viewport.
  assert.equal(needsScroll(1748, 1800, VIEW), true);
});

test("a paragraph below the fold is scrolled to", () => {
  // Listen mode, paragraphs 3 and 4 of the long passage.
  assert.equal(needsScroll(899, 1270, VIEW), true);
  assert.equal(needsScroll(1278, 1650, VIEW), true);
});

test("something scrolled off the top is brought back", () => {
  assert.equal(needsScroll(-300, -50, VIEW), true);
});

test("something taller than the screen still counts as needing a move", () => {
  // A long paragraph cannot fit; the caller centres it rather than giving up.
  assert.equal(needsScroll(10, 2000, VIEW), true);
});

test("partly visible is not visible enough", () => {
  // Half off the bottom: he would read three lines and hit the edge.
  assert.equal(needsScroll(700, 1100, VIEW), true);
  // A hair over the top margin.
  assert.equal(needsScroll(SCROLL_MARGIN - 1, 400, VIEW), true);
});
