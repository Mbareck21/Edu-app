/**
 * Which letters of `answer` to paint red after a missed spelling.
 *
 * The two spellings are lined up by edit distance, so one missing letter
 * marks that letter only: "becuse" for "because" marks the a, not every
 * letter after it. A letter he added has no letter of its own in the answer,
 * so the answer letter where it went in is marked instead.
 */
export function missedLetters(answer: string, typed: string): boolean[] {
  const a = answer.toLowerCase();
  const g = typed.trim().toLowerCase();
  const n = a.length;
  const m = g.length;
  // d[i][j]: fewest edits to turn a[0..i) into g[0..j).
  const d = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(
        d[i - 1][j - 1] + (a[i - 1] === g[j - 1] ? 0 : 1),
        d[i - 1][j] + 1,
        d[i][j - 1] + 1
      );
    }
  }

  const missed = new Array<boolean>(n).fill(false);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === g[j - 1] && d[i][j] === d[i - 1][j - 1]) {
      i--;
      j--;
    } else if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1) {
      missed[i - 1] = true; // wrong letter
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      missed[i - 1] = true; // left out
      i--;
    } else {
      if (n > 0) missed[Math.min(i, n - 1)] = true; // one too many
      j--;
    }
  }
  return missed;
}
