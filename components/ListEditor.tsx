"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientWordList } from "@/lib/models/WordList";

type Word = { word: string; clue: string; arabic: string };

export default function ListEditor({ list }: { list: ClientWordList }) {
  const router = useRouter();
  const [name, setName] = useState(list.name);
  const [hiddenMessage, setHiddenMessage] = useState(list.hiddenMessage);
  const [words, setWords] = useState<Word[]>(
    list.words.length
      ? list.words.map((w) => ({ word: w.word, clue: w.clue, arabic: w.arabic }))
      : [{ word: "", clue: "", arabic: "" }]
  );
  const [busy, setBusy] = useState<"saving" | "aiclues" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<Word>) {
    setWords((ws) => ws.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  }
  function addRow() {
    setWords((ws) => [...ws, { word: "", clue: "", arabic: "" }]);
  }
  function removeRow(i: number) {
    setWords((ws) =>
      ws.length === 1 ? [{ word: "", clue: "", arabic: "" }] : ws.filter((_, idx) => idx !== i)
    );
  }

  async function save() {
    setError(null);
    const clean = words
      .map((w) => ({
        word: w.word.trim().toLowerCase(),
        clue: w.clue.trim(),
        arabic: w.arabic.trim(),
      }))
      .filter((w) => w.word.length > 0);
    setBusy("saving");
    try {
      const res = await fetch(`/api/lists/${list._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), hiddenMessage: hiddenMessage.trim(), words: clean }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(typeof j.error === "string" ? j.error : "Could not save. Check word format (letters only).");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function aiClues() {
    setError(null);
    const targets = words.filter((w) => w.word.trim() && !w.clue.trim()).map((w) => w.word.trim().toLowerCase());
    if (targets.length === 0) {
      setError("Every word already has a clue. Clear one to regenerate.");
      return;
    }
    setBusy("aiclues");
    try {
      const res = await fetch(`/api/clues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: targets }),
      });
      if (!res.ok) {
        setError("AI clue generation failed. Make sure GROQ_API_KEY is set.");
        return;
      }
      const data = (await res.json()) as { clues: Record<string, string> };
      setWords((ws) =>
        ws.map((w) => {
          const key = w.word.trim().toLowerCase();
          if (!w.clue.trim() && data.clues[key]) return { ...w, clue: data.clues[key] };
          return w;
        })
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-3">
        <div>
          <label className="label" htmlFor="name">List name</label>
          <input id="name" className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="hm">Hidden message (optional — used in word search)</label>
          <input
            id="hm"
            className="input mt-1"
            placeholder="e.g. great job"
            value={hiddenMessage}
            onChange={(e) => setHiddenMessage(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">Letters only. Spaces are kept for word breaks. Max ~30 letters.</p>
        </div>
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Words & clues</h2>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={aiClues} disabled={busy !== null}>
              {busy === "aiclues" ? "Asking AI…" : "AI suggest clues"}
            </button>
            <button type="button" className="btn-secondary" onClick={addRow} disabled={busy !== null}>
              + Add word
            </button>
          </div>
        </div>

        <ul className="space-y-3">
          {words.map((w, i) => (
            <li key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_1fr_auto]">
              <input
                aria-label="word"
                className="input"
                placeholder="word"
                value={w.word}
                onChange={(e) => update(i, { word: e.target.value })}
              />
              <input
                aria-label="clue"
                className="input"
                placeholder="clue (or leave blank and click 'AI suggest clues')"
                value={w.clue}
                onChange={(e) => update(i, { clue: e.target.value })}
              />
              <input
                aria-label="arabic"
                className="input"
                placeholder="الترجمة"
                lang="ar"
                dir="rtl"
                value={w.arabic}
                onChange={(e) => update(i, { arabic: e.target.value })}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => removeRow(i)}
                aria-label="remove row"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={save} disabled={busy !== null}>
          {busy === "saving" ? "Saving…" : "Save"}
        </button>
        <a className="btn-secondary" href={`/lists/${list._id}/crossword`}>Open Crossword</a>
        <a className="btn-secondary" href={`/lists/${list._id}/scramble`}>Open Scramble</a>
        <a className="btn-secondary" href={`/lists/${list._id}/wordsearch`}>Open Word Search</a>
        <a className="btn-secondary" href={`/lists/${list._id}/reading`}>Open Reading</a>
        <a className="btn-secondary" href={`/lists/${list._id}/flashcards`}>Open Flashcards</a>
      </div>
    </div>
  );
}
