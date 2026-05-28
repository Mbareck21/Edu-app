// Wrapper around crossword-layout-generator. The library is plain JS — declared inline.
// It also `console.log`s every placement, which spams server logs. We silence those.

type ClgInputWord = { clue: string; answer: string };
type ClgOutputWord = ClgInputWord & {
  startx: number;        // 1-indexed
  starty: number;        // 1-indexed
  position: number;      // numbered clue
  orientation: "across" | "down" | "none";
};
type ClgResult = {
  rows: number;
  cols: number;
  table: string[][];     // each cell is a char or "-" for empty
  result: ClgOutputWord[];
};

interface Clg {
  generateLayout(input: ClgInputWord[]): ClgResult;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const clg = require("crossword-layout-generator") as Clg;

export type CrosswordPlacement = {
  word: string;
  clue: string;
  startRow: number;        // 0-indexed
  startCol: number;        // 0-indexed
  orientation: "across" | "down";
  position: number;
};

export type CrosswordResult =
  | {
      ok: true;
      rows: number;
      cols: number;
      grid: (string | null)[][]; // null = black square; string = answer letter
      placed: CrosswordPlacement[];
      unplaced: string[];
      skipped: string[];          // entries dropped (phrases, non-letters)
      across: CrosswordPlacement[];
      down: CrosswordPlacement[];
    }
  | {
      ok: false;
      reason: string;
      placed: CrosswordPlacement[];
      unplaced: string[];
      skipped: string[];
    };

export function buildCrossword(words: { word: string; clue: string }[]): CrosswordResult {
  const normalized = words.map((w) => ({
    word: w.word.trim().toLowerCase(),
    clue: (w.clue || "").trim(),
  }));
  const isLetterWord = (s: string) => /^[a-z]{2,}$/.test(s);
  const usable = normalized.filter((w) => isLetterWord(w.word));
  const skipped = normalized.filter((w) => w.word.length > 0 && !isLetterWord(w.word)).map((w) => w.word);

  if (usable.length < 2) {
    return {
      ok: false,
      reason: "Need at least 2 words with letters only.",
      placed: [],
      unplaced: usable.map((w) => w.word),
      skipped,
    };
  }

  const input: ClgInputWord[] = usable.map((w) => ({ clue: w.clue || w.word, answer: w.word }));

  // Suppress clg's console.log spam during placement.
  const origLog = console.log;
  console.log = () => {};
  let raw: ClgResult;
  try {
    raw = clg.generateLayout(input);
  } finally {
    console.log = origLog;
  }

  const placed: CrosswordPlacement[] = [];
  const unplaced: string[] = [];
  for (const r of raw.result) {
    if (r.orientation === "none") {
      unplaced.push(r.answer);
      continue;
    }
    placed.push({
      word: r.answer,
      clue: r.clue,
      startRow: r.starty - 1,
      startCol: r.startx - 1,
      orientation: r.orientation,
      position: r.position,
    });
  }

  // Fallback: if fewer than 60% of words placed, the layout is poor.
  if (placed.length < Math.ceil(usable.length * 0.6)) {
    return {
      ok: false,
      reason: `Only ${placed.length} of ${usable.length} words could be placed. Try words that share more letters.`,
      placed,
      unplaced,
      skipped,
    };
  }

  // Build a clean grid from `placed` (don't trust clg's `table` formatting).
  const grid: (string | null)[][] = Array.from({ length: raw.rows }, () =>
    Array.from({ length: raw.cols }, () => null)
  );
  for (const p of placed) {
    for (let i = 0; i < p.word.length; i++) {
      const r = p.startRow + (p.orientation === "down" ? i : 0);
      const c = p.startCol + (p.orientation === "across" ? i : 0);
      if (r < 0 || r >= raw.rows || c < 0 || c >= raw.cols) continue;
      grid[r][c] = p.word[i];
    }
  }

  const across = placed.filter((p) => p.orientation === "across").sort((a, b) => a.position - b.position);
  const down = placed.filter((p) => p.orientation === "down").sort((a, b) => a.position - b.position);

  return { ok: true, rows: raw.rows, cols: raw.cols, grid, placed, unplaced, skipped, across, down };
}
