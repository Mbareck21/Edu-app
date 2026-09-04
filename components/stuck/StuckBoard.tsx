"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import ChainRunner from "@/components/stuck/ChainRunner";
import type { WordSense } from "@/components/stuck/ChainRunner";
import { CHAIN_TARGET, ROTATE_WIDTH, type ChainState } from "@/lib/spell-chain";
import type { ClientWordList } from "@/lib/models/WordList";

export type StuckBoardProps = {
  list: ClientWordList;
  chains: Record<string, ChainState>;
};

/**
 * The Words tab: what he is stuck on, what he has finished, and the way in.
 *
 * The parent adds words here too, because he adds them at the moment his son
 * is stuck — mid-homework, one hand on the worksheet. Hiding that behind the
 * Me tab would mean the word never gets typed at all.
 */
export default function StuckBoard({ list, chains }: StuckBoardProps) {
  const [words, setWords] = useState(list.words.map((w) => w.word));
  const [senses, setSenses] = useState<Record<string, WordSense>>(() =>
    Object.fromEntries(list.words.map((w) => [w.word, { clue: w.clue, arabic: w.arabic }]))
  );
  const [state, setState] = useState(chains);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState<string[] | null>(null);

  const working = words.filter((w) => (state[w]?.current ?? 0) < CHAIN_TARGET);
  const finished = words.filter((w) => (state[w]?.current ?? 0) >= CHAIN_TARGET);

  async function add() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/stuck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNote(typeof data.error === "string" ? data.error : "That did not save.");
        return;
      }
      const rows: { word: string; clue: string; arabic: string }[] = data.list.words;
      const next = rows.map((w) => w.word);
      setWords(next);
      setSenses(Object.fromEntries(rows.map((w) => [w.word, { clue: w.clue, arabic: w.arabic }])));
      setState((s) => {
        const out = { ...s };
        for (const w of next) {
          if (!out[w]) {
            out[w] = { word: w, current: 0, best: 0, reps: 0, attempts: 0, graduatedAt: null };
          }
        }
        return out;
      });
      setText("");
      const parts: string[] = [];
      if (data.added.length > 0) parts.push(`Added ${data.added.join(", ")}.`);
      if (data.alreadyThere.length > 0) parts.push(`${data.alreadyThere.join(", ")} was already here.`);
      // Never swallow one: the parent must see what did not take.
      if (data.rejected.length > 0) parts.push(`Could not use: ${data.rejected.join(", ")}.`);
      setNote(parts.join(" ") || null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(word: string) {
    setWords((w) => w.filter((x) => x !== word));
    await fetch(`/api/stuck?word=${encodeURIComponent(word)}`, { method: "DELETE" });
  }

  if (running) {
    return (
      <div className="-mx-4">
        <ChainRunner
          words={running}
          senses={senses}
          chains={state}
          onDone={() => {
            setRunning(null);
            // The counts moved on the server; take the page again so the board
            // and the drill can never show different numbers.
            window.location.reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <Card color="blue" variant="soft">
        <label htmlFor="stuck-add" className="font-display text-base font-bold">
          Add a word he is stuck on
        </label>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          One, or several at once — separate them with commas or new lines.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            id="stuck-add"
            className="min-h-[52px] flex-1 rounded-tile border-2 px-3 text-base"
            style={{ borderColor: "var(--color-line)", background: "#fff" }}
            placeholder="fifty, thirty, eighty"
            value={text}
            autoCapitalize="none"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
          />
          <Button size="md" color="blue" disabled={!text.trim() || busy} onClick={() => void add()}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </div>
        {note ? <p className="mt-2 text-sm">{note}</p> : null}
      </Card>

      {working.length > 0 ? (
        <div>
          <Button
            fullWidth
            size="lg"
            color="green"
            onClick={() => setRunning(working.slice(0, ROTATE_WIDTH))}
          >
            Start writing
          </Button>
          <p className="mt-2 text-center text-sm" style={{ color: "var(--color-muted)" }}>
            {working.length === 1
              ? "One word to fix."
              : `${Math.min(working.length, ROTATE_WIDTH)} words this time, taking turns.`}
          </p>
        </div>
      ) : (
        <p className="text-center text-base" style={{ color: "var(--color-muted)" }}>
          {words.length === 0
            ? "No stuck words yet. Add one above when he gets one wrong."
            : "Every word is finished. Add another when one comes up."}
        </p>
      )}

      {working.length > 0 ? (
        <ul className="space-y-2">
          {working.map((w) => {
            const c = state[w];
            const done = c?.current ?? 0;
            return (
              <li key={w}>
                <Card>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-bold">{w}</p>
                      {senses[w]?.clue ? (
                        <p className="truncate text-sm" style={{ color: "var(--color-muted)" }}>
                          {senses[w].clue}
                        </p>
                      ) : null}
                      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                        {done} of {CHAIN_TARGET} in a row
                        {c && c.best > done ? ` · best ${c.best}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${w}`}
                      onClick={() => void remove(w)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                      style={{ color: "var(--color-muted)" }}
                    >
                      <Icon name="x" size={20} />
                    </button>
                  </div>
                  <div className="mt-3 flex gap-1" aria-hidden>
                    {Array.from({ length: CHAIN_TARGET }, (_, i) => (
                      <span
                        key={i}
                        className="h-2 flex-1 rounded-full"
                        style={{
                          background:
                            i < done
                              ? "var(--color-blue)"
                              : i < (c?.best ?? 0)
                                ? "var(--color-blue-soft)"
                                : "var(--color-line)",
                        }}
                      />
                    ))}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      {finished.length > 0 ? (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
            Finished
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {finished.map((w) => (
              <span
                key={w}
                className="rounded-full px-3 py-2 text-sm font-bold"
                style={{ background: "var(--color-green-soft)", color: "var(--color-green-dark)" }}
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { StuckBoard };
