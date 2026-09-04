"use client";

/**
 * Bring an element onto the screen, but only when it is actually off it.
 *
 * Long passages broke two promises at once. Tapping "Answer the questions" on
 * a 276-word reading left him at the top of the text he had just read, with
 * the question and the answer box 1748px below the fold and nothing on screen
 * to say anything had happened. And in listen mode the paragraph being read
 * aloud lit up below the fold, so "the part being read lights up" was true and
 * useless — following along is the whole point of that mode.
 *
 * Neither shows up on a level 1 passage, where 110 words fit on one screen.
 */

function reducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** How much clear space the element needs before we leave the page alone. */
export const SCROLL_MARGIN = 24;

/**
 * Should the page move to show this box? Split out from the DOM call so the
 * rule can be tested: the whole point is NOT scrolling when he can already see
 * the thing, because yanking the page under a nine-year-old mid-read is worse
 * than the problem being solved.
 */
export function needsScroll(top: number, bottom: number, viewport: number): boolean {
  return top < SCROLL_MARGIN || bottom > viewport - SCROLL_MARGIN;
}

export function scrollIntoViewIfNeeded(
  el: HTMLElement | null,
  block: ScrollLogicalPosition = "start"
): void {
  if (!el || typeof window === "undefined") return;
  const box = el.getBoundingClientRect();
  const view = window.innerHeight || document.documentElement.clientHeight;
  if (!needsScroll(box.top, box.bottom, view)) return;
  el.scrollIntoView({
    behavior: reducedMotion() ? "auto" : "smooth",
    block,
    inline: "nearest",
  });
}
