// Hidden-message word search generator.
//
// Algorithm:
//   1. Sanitize words and the hidden message to letters only (a–z).
//   2. Pick a starting grid side that has enough cells for: words + message + a little slack.
//   3. Place each word in a random direction (8 possible), respecting existing letters
//      (cell must be empty OR equal the letter being placed).
//   4. If a word can't be placed after N tries, grow the grid by one and restart.
//   5. Fill remaining empty cells: first with the hidden-message letters (row-major),
//      then with random a–z for any leftover cells.

export type Placement = {
  word: string;
  row: number;        // 0-indexed
  col: number;        // 0-indexed
  dRow: number;       // -1, 0, +1
  dCol: number;       // -1, 0, +1
};

export type WordSearchResult =
  | {
      ok: true;
      rows: number;
      cols: number;
      grid: string[][];                // every cell is a single letter
      placements: Placement[];         // for the answer key
      hiddenMessage: string;           // the cleaned hidden message, as embedded
      skipped: string[];               // entries dropped (phrases, non-letters)
    }
  | {
      ok: false;
      reason: string;
      skipped: string[];
    };

const DIRS: { dRow: number; dCol: number }[] = [
  { dRow: 0, dCol: 1 },    // E
  { dRow: 1, dCol: 0 },    // S
  { dRow: 1, dCol: 1 },    // SE
  { dRow: 1, dCol: -1 },   // SW
  { dRow: 0, dCol: -1 },   // W (backwards)
  { dRow: -1, dCol: 0 },   // N
  { dRow: -1, dCol: 1 },   // NE
  { dRow: -1, dCol: -1 },  // NW
];

function letters(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function tryPlace(
  grid: (string | null)[][],
  word: string,
  rows: number,
  cols: number,
  attempts: number
): Placement | null {
  for (let t = 0; t < attempts; t++) {
    const dir = DIRS[randInt(DIRS.length)];
    const endRow = (word.length - 1) * dir.dRow;
    const endCol = (word.length - 1) * dir.dCol;
    const minRow = Math.max(0, -endRow);
    const maxRow = Math.min(rows - 1, rows - 1 - endRow);
    const minCol = Math.max(0, -endCol);
    const maxCol = Math.min(cols - 1, cols - 1 - endCol);
    if (minRow > maxRow || minCol > maxCol) continue;
    const row = minRow + randInt(maxRow - minRow + 1);
    const col = minCol + randInt(maxCol - minCol + 1);

    let fits = true;
    for (let i = 0; i < word.length; i++) {
      const r = row + i * dir.dRow;
      const c = col + i * dir.dCol;
      const cell = grid[r][c];
      if (cell !== null && cell !== word[i]) {
        fits = false;
        break;
      }
    }
    if (!fits) continue;

    for (let i = 0; i < word.length; i++) {
      const r = row + i * dir.dRow;
      const c = col + i * dir.dCol;
      grid[r][c] = word[i];
    }
    return { word, row, col, dRow: dir.dRow, dCol: dir.dCol };
  }
  return null;
}

const MAX_SIDE = 20;

export function buildWordSearch(
  rawWords: string[],
  rawHiddenMessage: string
): WordSearchResult {
  // Drop entries that aren't pure letters. The grid is one-letter-per-cell, so
  // phrases like "climate change" would otherwise be silently concatenated to
  // "climatechange" while the "words to find" list still displays "CLIMATE
  // CHANGE" — making the puzzle unsolvable. Surface them as skipped instead.
  const skipped: string[] = [];
  const words: string[] = [];
  for (const raw of rawWords) {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.length === 0) continue;
    if (/^[a-z]{2,}$/.test(trimmed)) {
      words.push(trimmed);
    } else {
      skipped.push(trimmed);
    }
  }
  if (words.length === 0) {
    return { ok: false, reason: "No usable words (need letters only, length ≥ 2).", skipped };
  }
  const longest = Math.max(...words.map((w) => w.length));
  const hidden = letters(rawHiddenMessage);
  const totalLetters = words.reduce((s, w) => s + w.length, 0) + hidden.length;

  // Initial side: enough room for longest word + slack for placement.
  let side = Math.max(
    longest,
    Math.ceil(Math.sqrt(totalLetters * 1.3)) // ~30% slack
  );

  while (side <= MAX_SIDE) {
    const grid: (string | null)[][] = Array.from({ length: side }, () =>
      Array.from({ length: side }, () => null)
    );

    // Place longest words first.
    const order = words.slice().sort((a, b) => b.length - a.length);
    const placements: Placement[] = [];
    let failed = false;
    for (const w of order) {
      const p = tryPlace(grid, w, side, side, 150);
      if (!p) {
        failed = true;
        break;
      }
      placements.push(p);
    }

    if (failed) {
      side++;
      continue;
    }

    // We placed every word. Now make sure the hidden message also fits in the
    // remaining empty cells. If not, grow the grid.
    let emptyCount = 0;
    for (let r = 0; r < side; r++) {
      for (let c = 0; c < side; c++) {
        if (grid[r][c] === null) emptyCount++;
      }
    }
    if (emptyCount < hidden.length) {
      side++;
      continue;
    }

    // Fill empties: hidden message letters first (row-major), then random fillers.
    let mIdx = 0;
    for (let r = 0; r < side; r++) {
      for (let c = 0; c < side; c++) {
        if (grid[r][c] !== null) continue;
        if (mIdx < hidden.length) {
          grid[r][c] = hidden[mIdx++];
        } else {
          grid[r][c] = "abcdefghijklmnopqrstuvwxyz"[randInt(26)];
        }
      }
    }

    const finalGrid: string[][] = grid.map((row) => row.map((c) => c as string));
    // Sort placements alphabetically for the answer key.
    placements.sort((a, b) => a.word.localeCompare(b.word));
    return {
      ok: true,
      rows: side,
      cols: side,
      grid: finalGrid,
      placements,
      hiddenMessage: hidden,
      skipped,
    };
  }

  return {
    ok: false,
    reason: `Could not fit all words within a ${MAX_SIDE}×${MAX_SIDE} grid. Try fewer or shorter words, or shorten the hidden message.`,
    skipped,
  };
}

// Tiny helper to break the hidden message into the original-style word groups
// for display (so "good job" shows as "good" + "job", not as one blob).
export function splitHiddenForDisplay(original: string, embedded: string): string[] {
  // Re-walk the original, taking embedded letters in order, preserving word breaks.
  const out: string[] = [];
  let i = 0;
  for (const token of original.split(/\s+/)) {
    const lettersOnly = token.toLowerCase().replace(/[^a-z]/g, "");
    if (lettersOnly.length === 0) continue;
    const slice = embedded.slice(i, i + lettersOnly.length);
    if (slice.length === 0) break;
    out.push(slice);
    i += slice.length;
  }
  if (i < embedded.length) out.push(embedded.slice(i));
  return out;
}

export function shuffleArr<T>(arr: T[]): T[] {
  return shuffle(arr);
}
