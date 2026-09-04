/**
 * Turning what the parent typed into words.
 *
 * He adds words at the moment his son is stuck — mid-homework, one hand on the
 * worksheet. So the box takes one word or a whole line of them, however they
 * arrive: commas, newlines, semicolons, or just spaces between single words.
 *
 * What it will not do is guess. A word it cannot accept comes back in
 * `rejected` so the parent sees exactly what did not take, rather than finding
 * out later that four of the six he pasted are missing.
 *
 * Pure: no DB, no React.
 */

/** Matches the app's own word rule: letters, inner spaces, hyphens, apostrophes. */
const WORD_RE = /^[a-z][a-z'-]*(?: [a-z][a-z'-]*)*$/;

/** Long enough for "compare and contrast", short of a pasted sentence. */
const MAX_WORD_LEN = 40;

export type WordEntry = {
  /** Lowercased, trimmed, de-duplicated, in the order they were typed. */
  words: string[];
  /** What could not be accepted, as the parent typed it. */
  rejected: string[];
};

/**
 * Split on commas, semicolons and newlines. A line with none of those and more
 * than one bare word is treated as several words, so "fifty thirty eighty"
 * adds three — but "fair test" on its own stays one, because a two-word term
 * is a real thing he has to learn.
 */
function pieces(text: string): string[] {
  const parts = text
    .split(/[,;\n\r]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length !== 1) return parts;
  const single = parts[0];
  const words = single.split(/\s+/);
  // Three or more bare words is a list, not a term. Two could be either, and
  // "fair test" is the likelier reading of two.
  return words.length >= 3 ? words : [single];
}

export function parseWordEntry(text: string): WordEntry {
  const words: string[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();

  for (const raw of pieces(text)) {
    const clean = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!clean) continue;
    if (clean.length > MAX_WORD_LEN || !WORD_RE.test(clean)) {
      rejected.push(raw.trim());
      continue;
    }
    if (seen.has(clean)) continue;
    seen.add(clean);
    words.push(clean);
  }
  return { words, rejected };
}
