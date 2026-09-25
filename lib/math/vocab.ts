// The math words in a question, and what they mean.
//
// For a child learning English, a word problem is a reading test first:
// "gave away", "left over" and "in all" decide the whole sum, and missing
// one means a wrong answer about maths he can already do. Each of these
// words is marked in the question, and a tap shows a plain meaning and the
// Arabic. The same helpers turn a question into what the voice should say.
//
// Pure: safe to import from client components.

export type MathTerm = { term: string; meaning: string; arabic: string };

/** Longer phrases first, so "left over" wins over "left". */
const TERMS: readonly MathTerm[] = [
  { term: "how many times", meaning: "How many of the small one fit in the big one.", arabic: "كم مرة" },
  { term: "nearest", meaning: "The closest one.", arabic: "الأقرب" },
  { term: "left over", meaning: "What is still there after making equal groups.", arabic: "الباقي" },
  { term: "gave away", meaning: "Gave to someone else, so he has fewer. Subtract.", arabic: "أعطى" },
  { term: "in all", meaning: "All of them together. Often add or multiply.", arabic: "المجموع" },
  { term: "in each", meaning: "How many in one group.", arabic: "في كل واحدة" },
  { term: "full turn", meaning: "All the way around: 360°.", arabic: "دورة كاملة" },
  { term: "right angle", meaning: "A square corner: 90°.", arabic: "زاوية قائمة" },
  { term: "straight angle", meaning: "A straight line: 180°.", arabic: "زاوية مستقيمة" },
  { term: "together", meaning: "Put them all in one group. Add.", arabic: "معًا" },
  { term: "each", meaning: "Every one has the same amount.", arabic: "كل واحد" },
  { term: "left", meaning: "What is still there after some are gone. Subtract.", arabic: "المتبقي" },
  { term: "more", meaning: "A bigger amount. Add, or find the difference.", arabic: "أكثر" },
  { term: "fewer", meaning: "A smaller amount. Find the difference.", arabic: "أقل" },
  { term: "loses", meaning: "Has fewer after. Subtract.", arabic: "يفقد" },
  { term: "sold", meaning: "Gave for money, so there are fewer. Subtract.", arabic: "باع" },
  { term: "splits", meaning: "Cuts into equal parts. Divide.", arabic: "يقسم" },
  { term: "share", meaning: "Give out equally. Divide.", arabic: "يوزع بالتساوي" },
  { term: "groups", meaning: "Sets with the same number in each.", arabic: "مجموعات" },
  { term: "packs", meaning: "Boxes or bags with the same number inside.", arabic: "علب" },
  { term: "area", meaning: "The space inside a shape. Length × width.", arabic: "المساحة" },
  { term: "perimeter", meaning: "The distance all the way around a shape. Add every side.", arabic: "المحيط" },
  { term: "factors", meaning: "Numbers that multiply to make this number.", arabic: "العوامل" },
  { term: "multiple", meaning: "What you get when you multiply this number: 4, 8, 12…", arabic: "مضاعف" },
  { term: "value", meaning: "How much a digit is worth in its place.", arabic: "القيمة" },
  { term: "round", meaning: "Change to an easier, close number.", arabic: "قرّب" },
  { term: "tenths", meaning: "Parts when one whole is cut into 10.", arabic: "أعشار" },
  { term: "hundredths", meaning: "Parts when one whole is cut into 100.", arabic: "أجزاء من مئة" },
  { term: "cents", meaning: "Money: 100 cents make 1 dollar.", arabic: "سنتات" },
  { term: "wholes", meaning: "Full ones, not parts.", arabic: "وحدات كاملة" },
  { term: "whole", meaning: "A full one, not a part.", arabic: "كامل" },
  { term: "rest", meaning: "The part that is still missing.", arabic: "الباقي" },
  { term: "missing", meaning: "Not there yet. Find it.", arabic: "الناقص" },
  { term: "bigger", meaning: "More. The larger one.", arabic: "أكبر" },
];

export type Segment = { text: string; term?: MathTerm };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TERM_RE = new RegExp(`\\b(${TERMS.map((t) => escape(t.term)).join("|")})\\b`, "gi");
const BY_TERM = new Map(TERMS.map((t) => [t.term, t]));

/** The question cut into plain text and marked math words, in order. */
export function termSegments(prompt: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of prompt.matchAll(TERM_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: prompt.slice(last, at) });
    out.push({ text: m[0], term: BY_TERM.get(m[0].toLowerCase()) });
    last = at + m[0].length;
  }
  if (last < prompt.length) out.push({ text: prompt.slice(last) });
  return out;
}

/**
 * What the voice should say. Symbols read as words ("×" is "times", "?" in a
 * sum is "what"), and "3/4" as "3 over 4" rather than a date.
 */
export function speakable(prompt: string): string {
  return prompt
    .replace(/(\d),(?=\d{3})/g, "$1")
    .replace(/(\d+)\s*\/\s*(\d+)/g, "$1 over $2")
    .replace(/\?\s*\/\s*(\d+)/g, "what over $1")
    .replace(/°/g, " degrees")
    .replace(/×/g, " times ")
    .replace(/÷/g, " divided by ")
    .replace(/(^|[\s=×÷+-])\?(?=[\s.]|$)/g, "$1what ")
    .replace(/\+/g, " plus ")
    .replace(/(\d)\s*-\s*(?=\$?\d)/g, "$1 minus ")
    .replace(/=/g, " equals ")
    .replace(/\s+/g, " ")
    .trim();
}
