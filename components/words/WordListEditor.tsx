"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import type { Knowledge } from "@/lib/mastery";
import type { ClientWord, ClientWordList } from "@/lib/models/WordList";

type Row = { word: string; clue: string; arabic: string; state: Knowledge };

type Busy = null | "saving" | "clues" | "arabic" | "meanings";

const STATE_TONE: Record<Knowledge, { label: string; bg: string; fg: string }> = {
  new: { label: "New", bg: "var(--color-sand)", fg: "var(--color-muted)" },
  learning: { label: "Learning", bg: "var(--color-gold-soft)", fg: "var(--color-gold-ink)" },
  known: { label: "Known", bg: "var(--color-blue-soft)", fg: "var(--color-blue-dark)" },
  mastered: { label: "Mastered", bg: "var(--color-green-soft)", fg: "var(--color-green-dark)" },
};

/**
 * Word states are computed on the server and handed down: importing
 * lib/mastery here would drag the Mongoose model into the client bundle.
 */
export type WordStates = Record<string, Knowledge>;

function toRows(words: ClientWord[], states: WordStates): Row[] {
  if (words.length === 0) return [{ word: "", clue: "", arabic: "", state: "new" }];
  return words.map((w) => ({
    word: w.word,
    clue: w.clue,
    arabic: w.arabic,
    state: states[w.word] ?? "new",
  }));
}

function StateChip({ state }: { state: Knowledge }) {
  const t = STATE_TONE[state];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 font-display text-xs font-bold"
      style={{ background: t.bg, color: t.fg }}
    >
      {t.label}
    </span>
  );
}

export default function WordListEditor({
  list,
  states,
}: {
  list: ClientWordList;
  states: WordStates;
}) {
  const router = useRouter();
  const [name, setName] = useState(list.name);
  const [hiddenMessage, setHiddenMessage] = useState(list.hiddenMessage);
  const [rows, setRows] = useState<Row[]>(() => toRows(list.words, states));
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, { word: "", clue: "", arabic: "", state: "new" }]);
  }

  function removeRow(i: number) {
    setRows((rs) =>
      rs.length === 1
        ? [{ word: "", clue: "", arabic: "", state: "new" }]
        : rs.filter((_, idx) => idx !== i)
    );
  }

  function cleanRows() {
    return rows
      .map((r) => ({
        word: r.word.trim().toLowerCase(),
        clue: r.clue.trim(),
        arabic: r.arabic.trim(),
      }))
      .filter((r) => r.word.length > 0);
  }

  /** PATCH the list. Returns the saved list, or null when it failed. */
  async function save(): Promise<ClientWordList | null> {
    const res = await fetch(`/api/lists/${list._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        hiddenMessage: hiddenMessage.trim(),
        words: cleanRows(),
      }),
    });
    if (!res.ok) {
      setError("Could not save. Words take letters, spaces and hyphens only.");
      return null;
    }
    return (await res.json()) as ClientWordList;
  }

  async function onSave() {
    setError(null);
    setNote(null);
    setBusy("saving");
    try {
      const saved = await save();
      if (saved) {
        setRows(toRows(saved.words, states));
        setNote("Saved.");
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function aiClues() {
    setError(null);
    setNote(null);
    const targets = rows
      .filter((r) => r.word.trim() && !r.clue.trim())
      .map((r) => r.word.trim().toLowerCase());
    if (targets.length === 0) {
      setNote("Every word already has a clue. Clear one to rewrite it.");
      return;
    }
    setBusy("clues");
    try {
      const res = await fetch("/api/clues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: targets }),
      });
      if (!res.ok) {
        setError("The AI could not write clues right now.");
        return;
      }
      const data = (await res.json()) as { clues: Record<string, string> };
      setRows((rs) =>
        rs.map((r) => {
          const key = r.word.trim().toLowerCase();
          return !r.clue.trim() && data.clues[key] ? { ...r, clue: data.clues[key] } : r;
        })
      );
      setNote("Clues written. Save to keep them.");
    } finally {
      setBusy(null);
    }
  }

  /** Translate and Meanings both work on the saved doc, so save first. */
  async function aiOnServer(kind: "arabic" | "meanings") {
    setError(null);
    setNote(null);
    setBusy(kind);
    try {
      const saved = await save();
      if (!saved) return;
      const path = kind === "arabic" ? "translate" : "explain";
      const res = await fetch(`/api/lists/${list._id}/flashcards/${path}`, {
        method: "POST",
      });
      if (!res.ok) {
        setError("The AI could not finish that right now.");
        return;
      }
      const fresh = (await res.json()) as ClientWordList;
      setRows(toRows(fresh.words, states));
      setNote(kind === "arabic" ? "Arabic filled in." : "Meanings written.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <label className="font-display text-sm font-bold" htmlFor="list-name">
          List name
        </label>
        <input
          id="list-name"
          className="mt-2 min-h-[52px] w-full rounded-tile border-2 px-3 text-base"
          style={{ borderColor: "var(--color-line)", background: "#fff" }}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="mt-4 block font-display text-sm font-bold" htmlFor="list-hm">
          Hidden message
        </label>
        <input
          id="list-hm"
          className="mt-2 min-h-[52px] w-full rounded-tile border-2 px-3 text-base"
          style={{ borderColor: "var(--color-line)", background: "#fff" }}
          placeholder="great job"
          value={hiddenMessage}
          onChange={(e) => setHiddenMessage(e.target.value)}
        />
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          Letters only, up to about 30. It hides inside the word search.
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Words</h2>
          <Button size="md" variant="secondary" color="green" onClick={addRow} disabled={busy !== null}>
            <Icon name="plus" size={18} />
            Add
          </Button>
        </div>

        <ul className="mt-4 space-y-4">
          {rows.map((r, i) => (
            <li
              key={i}
              className="rounded-tile border p-3"
              style={{ borderColor: "var(--color-line)" }}
            >
              <div className="flex items-center gap-2">
                <input
                  aria-label="word"
                  className="min-h-[48px] flex-1 rounded-tile border-2 px-3 font-display text-base font-bold"
                  style={{ borderColor: "var(--color-line)", background: "#fff" }}
                  placeholder="word"
                  value={r.word}
                  onChange={(e) => update(i, { word: e.target.value })}
                />
                <StateChip state={r.state} />
                <button
                  type="button"
                  aria-label="Remove word"
                  onClick={() => removeRow(i)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                  style={{ color: "var(--color-muted)" }}
                >
                  <Icon name="x" size={22} />
                </button>
              </div>
              <input
                aria-label="clue"
                className="mt-2 min-h-[48px] w-full rounded-tile border-2 px-3 text-base"
                style={{ borderColor: "var(--color-line)", background: "#fff" }}
                placeholder="clue"
                value={r.clue}
                onChange={(e) => update(i, { clue: e.target.value })}
              />
              <input
                aria-label="arabic"
                lang="ar"
                dir="rtl"
                className="mt-2 min-h-[48px] w-full rounded-tile border-2 px-3 text-base"
                style={{ borderColor: "var(--color-line)", background: "#fff" }}
                placeholder="الترجمة"
                value={r.arabic}
                onChange={(e) => update(i, { arabic: e.target.value })}
              />
            </li>
          ))}
        </ul>
      </Card>

      <Card variant="soft" color="green">
        <h2 className="font-display text-lg font-bold">Let the AI fill it in</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="md" color="green" onClick={aiClues} disabled={busy !== null}>
            {busy === "clues" ? "Writing…" : "Write clues"}
          </Button>
          <Button
            size="md"
            color="blue"
            onClick={() => void aiOnServer("meanings")}
            disabled={busy !== null}
          >
            {busy === "meanings" ? "Writing…" : "Write meanings"}
          </Button>
          <Button
            size="md"
            color="purple"
            onClick={() => void aiOnServer("arabic")}
            disabled={busy !== null}
          >
            {busy === "arabic" ? "Translating…" : "Add Arabic"}
          </Button>
        </div>
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          Meanings and Arabic save the list first, then fill the blanks.
        </p>
      </Card>

      {error ? (
        <p className="text-sm" style={{ color: "var(--color-coral-dark)" }}>
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="text-sm" style={{ color: "var(--color-green-dark)" }}>
          {note}
        </p>
      ) : null}

      <Button fullWidth size="lg" color="green" onClick={onSave} disabled={busy !== null}>
        {busy === "saving" ? "Saving…" : "Save list"}
      </Button>
    </div>
  );
}

export { WordListEditor };
