/** Pure math engine types. No UI, no DB, no side effects. */

export type MathSkillId =
  | "place-value"
  | "add-sub-big"
  | "mul-facts"
  | "mul-multi"
  | "word-problems"
  | "division"
  | "factors-multiples"
  | "fractions"
  | "data"
  | "decimals"
  | "geometry"
  | "angles"
  | "shapes";

/** 1 = start of Grade 4, 3 = end of Grade 4. */
export type Level = 1 | 2 | 3;

/** Any function that returns a float in [0, 1). Inject it so questions are reproducible. */
export type Rng = () => number;

export type MathOp = "+" | "-" | "×" | "÷" | "?";

export type PlaceName = "ones" | "tens" | "hundreds" | "thousands";

export type ShapeName =
  | "rectangle"
  | "square"
  | "rhombus"
  | "parallelogram"
  | "trapezoid"
  | "right triangle"
  | "acute triangle"
  | "obtuse triangle";

export type DataRow = { label: string; value: number };

/** Optional picture the runner may draw next to the prompt. */
export type Visual =
  | { kind: "groups"; groups: number; per: number }
  | { kind: "bar"; a: number; b: number }
  | { kind: "tenframes"; n: number }
  | { kind: "placevalue"; value: number; place: PlaceName }
  | { kind: "rect"; w: number; h: number; label: "area" | "perimeter" }
  | { kind: "table"; rows: DataRow[] }
  | { kind: "bars"; bars: DataRow[]; scale: number }
  | { kind: "angle"; total: number; known: number }
  | { kind: "shape"; name: ShapeName }
  | { kind: "none" };

export type MathQuestion = {
  /** Grade-3 reading level. Always 80 characters or fewer. */
  prompt: string;
  /** Always a whole number >= 0 so a number pad is enough. */
  answer: number;
  visual: Visual;
  /** One short line that shows the steps with real numbers. 90 characters or fewer. */
  how: string;
  op: MathOp;
  a?: number;
  b?: number;
};

export type MathSkill = {
  id: MathSkillId;
  /** Two words max. */
  name: string;
  /** One short sentence. */
  blurb: string;
  grade: 3 | 4;
  color: "purple";
  /** Id of the school unit this skill belongs to (see MATH_UNITS). */
  unit: number;
  /** District standard codes, e.g. "4.NPV.2". Empty when the unit lists none. */
  standards: string[];
  generate(level: Level, rng: Rng): MathQuestion;
};

/** One unit of the Fayetteville Public Schools Grade 4 year-at-a-glance. */
export type MathUnit = {
  id: number;
  name: string;
  /** "Q1", "Q1-Q2", ... */
  quarter: string;
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD */
  end: string;
  standards: string[];
  skills: MathSkillId[];
};
