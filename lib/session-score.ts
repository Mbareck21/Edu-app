/**
 * How a session is scored. One rule, used by the server that pays for it, the
 * server that levels on it, and the screen that shows it — so they can never
 * disagree.
 *
 * The case this exists for: a timed maths drill where he answered ONE question
 * in sixty seconds, got it right, and was scored 100%, marked perfect, paid
 * the perfect bonus, and had that 100 pushed into the level-up window. Three
 * of those in a row would have levelled him up on three answers. "As many as
 * you can in a minute" cannot be a fraction of however few he got to.
 *
 * So a timed run is measured against a floor: the fewest answers a minute can
 * honestly be judged on. His fixed ten-question lessons take 45 to 185
 * seconds, so five in sixty seconds is under any real pace, and it means one
 * right answer scores what it is — one fifth of the least a run should show.
 *
 * Pure: no clock, no storage.
 */

/** Fewest answers a timed run is judged on. Below it, it is scored as if it had this many. */
export const TIMED_MIN_ANSWERED = 5;

export type Scorable = {
  answered: number;
  correct: number;
  /** "As many as you can" against a clock, rather than a fixed set. */
  timed?: boolean;
};

/** The denominator a run is judged on. */
function judgedOn(s: Scorable): number {
  const answered = Math.max(0, Math.floor(s.answered) || 0);
  return s.timed ? Math.max(answered, TIMED_MIN_ANSWERED) : answered;
}

/** 0-100. A relaxed run is right-over-asked; a timed run is right-over-the-floor. */
export function sessionPct(s: Scorable): number {
  const on = judgedOn(s);
  if (on <= 0) return 0;
  // Clamp to what he ANSWERED, not to the floor: a wire claiming more right
  // answers than questions must not be able to fill the floor for free.
  const answered = Math.max(0, Math.floor(s.answered) || 0);
  const correct = Math.min(answered, Math.max(0, Math.floor(s.correct) || 0));
  return Math.round((correct / on) * 100);
}

/**
 * Every one right, and enough of them for that to mean something. A timed run
 * has to clear the floor; one right of one is not perfect, it is short.
 */
export function sessionPerfect(s: Scorable): boolean {
  const answered = Math.max(0, Math.floor(s.answered) || 0);
  const correct = Math.max(0, Math.floor(s.correct) || 0);
  if (answered <= 0 || correct < answered) return false;
  return s.timed ? answered >= TIMED_MIN_ANSWERED : true;
}
