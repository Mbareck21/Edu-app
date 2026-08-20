"use client";

import { useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import GameBar from "@/components/games/GameBar";
import DoneCard from "@/components/games/DoneCard";
import Icon from "@/components/ui/Icon";
import { tone } from "@/components/ui/colors";
import { celebrate, encourage } from "@/lib/feedback";
import { sfx } from "@/lib/sfx";

const GREEN = tone("green");
const CORAL = tone("coral");

export type ScramblePlayRow = { scrambled: string; answer: string; clue: string };

type RowState = {
  scrambled: string;
  answer: string;
  clue: string;
  /** One tile per letter of the scramble, spaces dropped. */
  letters: string[];
  /** Answer word lengths, so a phrase keeps its gap between words. */
  groups: number[];
  /** Slot → tile index, or null when the slot is still empty. */
  slots: (number | null)[];
  status: "idle" | "wrong" | "correct";
  wrongCount: number;
  revealed: boolean;
  shakeKey: number;
};

export default function InteractiveScramble({
  rows: initial,
}: {
  rows: ScramblePlayRow[];
}) {
  const buildRows = (): RowState[] =>
    initial.map((r) => {
      const letters = r.scrambled.replace(/\s+/g, "").split("");
      const groups = r.answer.split(/\s+/).map((w) => w.length);
      return {
        scrambled: r.scrambled,
        answer: r.answer,
        clue: r.clue,
        letters,
        groups,
        slots: Array<number | null>(letters.length).fill(null),
        status: "idle" as const,
        wrongCount: 0,
        revealed: false,
        shakeKey: 0,
      };
    });

  const [rows, setRows] = useState<RowState[]>(buildRows);
  const [finished, setFinished] = useState(false);
  const finishedFiredRef = useRef(false);
  const router = useRouter();

  function reset() {
    setRows(buildRows());
    setFinished(false);
    finishedFiredRef.current = false;
    // Re-run the (force-dynamic) server component for fresh scrambles + word pick.
    router.refresh();
  }

  function settle(i: number, slots: (number | null)[], source: HTMLElement | null) {
    const row = rows[i];
    const guess = slots.map((t) => (t === null ? "" : row.letters[t])).join("");
    // Compare letters-only so a phrase answer ("CLIMATE CHANGE") is judged on
    // its letters, exactly as the typed version used to.
    const answerLetters = row.answer.replace(/[^A-Z]/g, "");

    if (guess === answerLetters) {
      setRows((prev) => prev.map((x, idx) => (idx === i ? { ...x, slots, status: "correct" } : x)));
      sfx.correct();
      celebrate({ source });
      const allDone = rows.every((x, idx) => (idx === i ? true : x.status === "correct"));
      if (allDone && !finishedFiredRef.current) {
        finishedFiredRef.current = true;
        setFinished(true);
        setTimeout(() => celebrate({ big: true }), 600);
      }
      return;
    }

    setRows((prev) =>
      prev.map((x, idx) =>
        idx === i
          ? { ...x, slots, status: "wrong", wrongCount: x.wrongCount + 1, shakeKey: x.shakeKey + 1 }
          : x
      )
    );
    sfx.wrong();
    if (row.wrongCount === 0) encourage();
  }

  /** Tap a letter tile: it drops into the first empty slot. */
  function placeLetter(i: number, tile: number, e: React.MouseEvent<HTMLButtonElement>) {
    const row = rows[i];
    if (row.status === "correct" || row.slots.includes(tile)) return;
    const at = row.slots.indexOf(null);
    if (at === -1) return;
    const slots = row.slots.slice();
    slots[at] = tile;
    sfx.tap();
    const card = e.currentTarget.closest("li") as HTMLElement | null;
    if (slots.every((s) => s !== null)) {
      settle(i, slots, card);
    } else {
      setRows((prev) => prev.map((x, idx) => (idx === i ? { ...x, slots, status: "idle" } : x)));
    }
  }

  /** Tap a filled slot: the letter goes back to the tile row. */
  function takeBack(i: number, at: number) {
    const row = rows[i];
    if (row.status === "correct" || row.slots[at] === null) return;
    const slots = row.slots.slice();
    slots[at] = null;
    sfx.tap();
    setRows((prev) => prev.map((x, idx) => (idx === i ? { ...x, slots, status: "idle" } : x)));
  }

  function clearRow(i: number) {
    const row = rows[i];
    if (row.status === "correct") return;
    sfx.tap();
    setRows((prev) =>
      prev.map((x, idx) =>
        idx === i ? { ...x, slots: Array<number | null>(x.letters.length).fill(null), status: "idle" } : x
      )
    );
  }

  function reveal(i: number) {
    setRows((prev) =>
      prev.map((x, idx) => {
        if (idx !== i) return x;
        // Lay the answer out over the tiles so the finished card reads right.
        const pool = x.letters.map((ch, t) => ({ ch, t }));
        const slots = x.answer
          .replace(/[^A-Z]/g, "")
          .split("")
          .map((ch) => {
            const hit = pool.findIndex((p) => p.ch === ch);
            return hit === -1 ? null : pool.splice(hit, 1)[0].t;
          });
        return { ...x, slots, status: "correct", revealed: true };
      })
    );
  }

  const solved = rows.filter((r) => r.status === "correct").length;

  return (
    <section className="pb-6">
      <GameBar color="green" done={solved} total={rows.length} unit="solved" onReset={reset} />

      {finished && (
        <DoneCard title="All done!" line="Every word is unscrambled." color="green" onAgain={reset} />
      )}

      <p className="mt-3 text-sm" style={{ color: "var(--color-muted)" }}>
        Tap the letters to spell the word. Tap a letter you placed to take it back.
      </p>

      <ol className="mt-3 space-y-3">
        {rows.map((r, i) =>
          r.status === "correct" ? (
            <li
              key={i}
              className="q-bounce-in flex items-center gap-2 rounded-card border px-3 py-2"
              style={{ background: GREEN.soft, borderColor: GREEN.base }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ background: GREEN.base, color: GREEN.on }}
              >
                <Icon name="check" size={18} />
              </span>
              <span
                className="font-display text-lg font-bold uppercase tracking-wide"
                style={{ color: GREEN.onSoft }}
              >
                {r.answer}
              </span>
              {r.revealed && (
                <span className="ml-auto text-xs" style={{ color: "var(--color-muted)" }}>
                  shown
                </span>
              )}
            </li>
          ) : (
            <li
              key={i}
              className={"rounded-card border bg-white p-3" + (r.status === "wrong" ? " q-shake" : "")}
              style={{ borderColor: r.status === "wrong" ? CORAL.base : "var(--color-line)" }}
              data-shake={r.shakeKey}
            >
              <div className="flex items-start gap-2">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold"
                  style={{ background: GREEN.soft, color: GREEN.onSoft }}
                >
                  {i + 1}
                </span>
                <p className="flex-1 text-sm leading-snug">
                  {r.clue || (
                    <span style={{ color: "var(--color-muted)" }}>
                      Spell the word from these letters.
                    </span>
                  )}
                </p>
              </div>

              <Slots row={r} onTake={(at) => takeBack(i, at)} />

              <div className="mt-3 flex flex-wrap gap-2">
                {r.letters.map((ch, t) => {
                  const used = r.slots.includes(t);
                  const look: CSSProperties = {
                    background: GREEN.soft,
                    borderColor: GREEN.base,
                    color: GREEN.onSoft,
                    ["--btn-shade" as string]: GREEN.base,
                    opacity: used ? 0 : 1,
                    transform: used ? "scale(0.5)" : "scale(1)",
                    transition: "opacity 180ms ease-out, transform 180ms ease-out",
                  };
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={used}
                      onClick={(e) => placeLetter(i, t, e)}
                      aria-label={`Letter ${ch}`}
                      className="g-tile press-3d h-12 w-11 text-xl"
                      style={look}
                    >
                      {ch}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => clearRow(i)}
                  disabled={r.slots.every((s) => s === null)}
                  className="flex h-11 items-center gap-1.5 rounded-full px-3 font-display text-sm font-bold disabled:opacity-40"
                  style={{ color: "var(--color-muted)" }}
                >
                  <Icon name="backspace" size={16} />
                  Clear
                </button>
                {r.wrongCount >= 2 && !r.revealed && (
                  <button
                    type="button"
                    onClick={() => reveal(i)}
                    className="ml-auto flex h-11 items-center rounded-full px-3 font-display text-sm font-bold underline"
                    style={{ color: "var(--color-muted)" }}
                  >
                    Show answer
                  </button>
                )}
              </div>
            </li>
          )
        )}
      </ol>
    </section>
  );
}

/** Running start index for each word, so no counter is mutated mid-render. */
function groupStarts(lengths: number[]): number[] {
  const out: number[] = [];
  let n = 0;
  for (const len of lengths) {
    out.push(n);
    n += len;
  }
  return out;
}

/** The answer slots, split into the answer's own words. */
function Slots({ row, onTake }: { row: RowState; onTake: (at: number) => void }) {
  const starts = groupStarts(row.groups);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      {row.groups.map((len, g) => (
        <div key={g} className="flex gap-1.5">
          {Array.from({ length: len }).map((_, k) => {
            const index = starts[g] + k;
            const tile = row.slots[index];
            const ch = tile === null ? "" : row.letters[tile];
            return (
              <button
                key={index}
                type="button"
                onClick={() => onTake(index)}
                disabled={tile === null}
                aria-label={ch ? `Take back ${ch}` : "Empty slot"}
                className={"g-tile h-12 w-10 text-xl" + (ch ? " g-drop" : "")}
                style={
                  ch
                    ? {
                        background: "#fff",
                        borderColor:
                          row.status === "wrong" ? CORAL.base : "var(--color-ink)",
                        color: row.status === "wrong" ? CORAL.onSoft : "var(--color-ink)",
                      }
                    : {
                        background: "var(--color-sand)",
                        borderStyle: "dashed",
                        borderColor: "var(--color-faint)",
                      }
                }
              >
                {ch}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
