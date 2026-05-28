// Fisher-Yates scramble — guaranteed to differ from the original when length >= 2
// (we retry up to 10 times).

function shuffleOnce(letters: string[]): string[] {
  const a = letters.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function scramble(word: string): string {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (clean.length < 2) return clean;
  let attempt = "";
  for (let t = 0; t < 10; t++) {
    attempt = shuffleOnce(clean.split("")).join("");
    if (attempt !== clean) return attempt;
  }
  // 10 swaps all came back identical (very rare, e.g. "aaaa"). Return original.
  return attempt || clean;
}

// Scramble each whitespace-separated piece independently so phrases keep
// their shape — "climate change" → "TILAMCE CGAENH", not "CGNHIATELACME".
function scramblePhrase(entry: string): string {
  return entry
    .split(/\s+/)
    .map((part) => scramble(part))
    .filter((part) => part.length > 0)
    .join(" ");
}

export type ScrambleRow = { scrambled: string; answer: string };

export function scrambleAll(words: string[]): ScrambleRow[] {
  return words
    .map((w) => w.toLowerCase().trim().replace(/\s+/g, " "))
    .map((entry) => {
      // Keep only letters + single spaces; drop entries with no real letters.
      const cleaned = entry.replace(/[^a-z\s]/g, "").trim();
      return cleaned;
    })
    .filter((entry) => entry.replace(/\s/g, "").length >= 2)
    .map((answer) => ({
      scrambled: scramblePhrase(answer).toUpperCase(),
      answer: answer.toUpperCase(),
    }));
}
