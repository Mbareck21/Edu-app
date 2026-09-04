import { groq, CLUE_MODEL, CLUE_SYSTEM_PROMPT } from "@/lib/groq";

/**
 * One Groq call writes a clue for each word.
 *
 * Shared by the school-list seeder and the stuck-word pool, because a word
 * with no clue can only ever reach the spelling tests: every item that asks
 * "which word means this?" needs a meaning to show. A stuck word without one
 * would sit out of the very tests it was added to appear in.
 *
 * Failure is fine and silent by design — the word is still added, and the
 * parent can fill clues from the editor later. Losing the word because the AI
 * was down would be the worse outcome.
 */
export async function fillClues(words: string[]): Promise<Record<string, string>> {
  if (words.length === 0) return {};
  try {
    const completion = await groq().chat.completions.create({
      model: CLUE_MODEL,
      messages: [
        { role: "system", content: CLUE_SYSTEM_PROMPT },
        { role: "user", content: `Write a clue for each of these words:\n${words.join(", ")}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_tokens: 4000,
      reasoning_effort: "low",
    });
    const payload = JSON.parse(completion.choices[0]?.message?.content || "{}") as {
      clues?: Record<string, string>;
    };
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
    const byNormalized = new Map<string, string>();
    for (const [k, v] of Object.entries(payload.clues ?? {})) {
      if (typeof v === "string" && v.trim()) byNormalized.set(normalize(k), v.trim());
    }
    const out: Record<string, string> = {};
    for (const w of words) {
      const v = byNormalized.get(normalize(w));
      if (v) out[w] = v;
    }
    return out;
  } catch {
    return {};
  }
}
