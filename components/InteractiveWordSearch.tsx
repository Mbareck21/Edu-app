"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import GameBar from "@/components/games/GameBar";
import DoneCard from "@/components/games/DoneCard";
import Icon from "@/components/ui/Icon";
import { tone } from "@/components/ui/colors";
import { celebrate, encourage } from "@/lib/feedback";
import { sfx } from "@/lib/sfx";
import { splitHiddenForDisplay } from "@/lib/wordsearch";

type Cell = { r: number; c: number };
type FoundWord = { word: string; path: Cell[] };

const PURPLE = tone("purple");
const GOLD = tone("gold");
const CELL = 36;
const GAP = 3;
const STEP = CELL + GAP;
const REVEAL_MS = 130;

export default function InteractiveWordSearch({
  rows,
  cols,
  grid,
  words,
  skipped = [],
  hiddenMessage = "",
  hiddenEmbedded = "",
}: {
  rows: number;
  cols: number;
  grid: string[][];
  words: string[];      // canonical, lowercase, letters-only
  skipped?: string[];
  /** The parent's message, as typed — only used for the word breaks. */
  hiddenMessage?: string;
  /** The letters actually baked into the grid, in reading order. */
  hiddenEmbedded?: string;
}) {
  // Words still to find (uppercase keys for display).
  const targetSet = useMemo(() => {
    const s = new Set<string>();
    for (const w of words) {
      const clean = w.toUpperCase().replace(/[^A-Z]/g, "");
      if (clean.length >= 2) s.add(clean);
    }
    return s;
  }, [words]);

  const [foundWords, setFoundWords] = useState<FoundWord[]>([]);
  const found = useMemo(() => new Set(foundWords.map((f) => f.word)), [foundWords]);

  // Drag selection state. `dragStart` non-null means a drag is in progress.
  // `dragPath` is the current straight-line selection from start through the
  // cell currently under the finger. `flashPath` is the brief miss highlight.
  const [dragStart, setDragStart] = useState<Cell | null>(null);
  const [dragPath, setDragPath] = useState<Cell[]>([]);
  const [flashPath, setFlashPath] = useState<Cell[]>([]);

  // Refs the document-level pointer listeners read each move/up. State alone
  // would give the listeners stale closures.
  const dragStartRef = useRef<Cell | null>(null);
  const dragPathRef = useRef<Cell[]>([]);
  const flashTimerRef = useRef<number | null>(null);
  const finishedFiredRef = useRef(false);
  const unlockedRef = useRef(false);
  const router = useRouter();

  const [finished, setFinished] = useState(false);
  const [revealed, setRevealed] = useState(0);

  const messageParts = useMemo(
    () => (hiddenEmbedded ? splitHiddenForDisplay(hiddenMessage || hiddenEmbedded, hiddenEmbedded) : []),
    [hiddenMessage, hiddenEmbedded]
  );
  const allFound = targetSet.size > 0 && found.size === targetSet.size;

  // The message turns over one letter at a time once every word is found.
  useEffect(() => {
    if (!allFound || hiddenEmbedded.length === 0) return;
    if (!unlockedRef.current) {
      unlockedRef.current = true;
      sfx.chest();
    }
    const id = window.setInterval(() => {
      setRevealed((n) => (n >= hiddenEmbedded.length ? n : n + 1));
    }, REVEAL_MS);
    return () => window.clearInterval(id);
  }, [allFound, hiddenEmbedded.length]);

  function reset() {
    setFoundWords([]);
    setDragStart(null);
    setDragPath([]);
    setFlashPath([]);
    setFinished(false);
    setRevealed(0);
    dragStartRef.current = null;
    dragPathRef.current = [];
    finishedFiredRef.current = false;
    unlockedRef.current = false;
    // Re-run the (force-dynamic) server component for a fresh grid + word pick.
    router.refresh();
  }

  // Compute straight-line cells between two endpoints inclusive, or null if
  // they don't lie on a shared 8-direction line.
  function pathBetween(a: Cell, b: Cell): Cell[] | null {
    const dr = b.r - a.r;
    const dc = b.c - a.c;
    if (dr === 0 && dc === 0) return [a];
    const adr = Math.abs(dr);
    const adc = Math.abs(dc);
    if (dr !== 0 && dc !== 0 && adr !== adc) return null; // not a clean diagonal
    const steps = Math.max(adr, adc);
    const sr = dr === 0 ? 0 : dr / adr;
    const sc = dc === 0 ? 0 : dc / adc;
    const out: Cell[] = [];
    for (let i = 0; i <= steps; i++) {
      out.push({ r: a.r + sr * i, c: a.c + sc * i });
    }
    return out;
  }

  function flashMiss(cells: Cell[]) {
    setFlashPath(cells);
    if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlashPath([]), 420);
  }

  function commitSelection(path: Cell[]) {
    if (path.length < 2) return; // single tap, nothing to do
    const word = path.map((p) => grid[p.r][p.c]).join("").toUpperCase();
    const reversed = word.split("").reverse().join("");
    let hit: string | null = null;
    if (targetSet.has(word) && !found.has(word)) hit = word;
    else if (targetSet.has(reversed) && !found.has(reversed)) hit = reversed;

    if (hit) {
      const winning = hit;
      setFoundWords((prev) => [...prev, { word: winning, path }]);
      // Confetti from the first cell of the path.
      const firstEl = document.querySelector(
        `[data-cell-r="${path[0].r}"][data-cell-c="${path[0].c}"]`
      ) as HTMLElement | null;
      sfx.correct();
      celebrate({ source: firstEl ?? undefined });
      const allDone = Array.from(targetSet).every((w) => w === winning || found.has(w));
      if (allDone && !finishedFiredRef.current) {
        finishedFiredRef.current = true;
        setFinished(true);
        setTimeout(() => celebrate({ big: true }), 600);
      }
    } else {
      flashMiss(path);
      sfx.wrong();
      if (Math.random() < 0.35) encourage();
    }
  }

  // Find the cell under a screen point by looking up data-cell-* attributes
  // on whatever element is at (clientX, clientY).
  function cellFromPoint(clientX: number, clientY: number): Cell | null {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const cellEl = (el as Element).closest("[data-cell-r]");
    if (!cellEl) return null;
    const r = Number(cellEl.getAttribute("data-cell-r"));
    const c = Number(cellEl.getAttribute("data-cell-c"));
    if (Number.isNaN(r) || Number.isNaN(c)) return null;
    return { r, c };
  }

  // Document-level pointer listeners while a drag is in progress. Touch
  // pointers are captured to the original element by default, so we hit-test
  // via elementFromPoint to find the cell under the finger as it moves over
  // OTHER cells.
  useEffect(() => {
    if (!dragStart) return;

    function handleMove(e: PointerEvent) {
      const start = dragStartRef.current;
      if (!start) return;
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (!cell) return;
      const path = pathBetween(start, cell);
      // If finger wandered off the 8-direction lines, keep the last valid
      // path on screen — visual "snaps back" when finger returns to a line.
      if (!path) return;
      dragPathRef.current = path;
      setDragPath(path);
      // Prevent text selection / scroll while dragging.
      e.preventDefault();
    }

    function handleUp() {
      const path = dragPathRef.current;
      setDragStart(null);
      setDragPath([]);
      dragStartRef.current = null;
      dragPathRef.current = [];
      commitSelection(path);
    }

    document.addEventListener("pointermove", handleMove, { passive: false });
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleUp);
    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragStart]);

  function onCellPointerDown(r: number, c: number, e: React.PointerEvent<HTMLElement>) {
    // Release the implicit pointer capture so subsequent pointer events fire
    // wherever the finger is, not on this initial target.
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore — not all browsers support / require this
    }
    const start = { r, c };
    dragStartRef.current = start;
    dragPathRef.current = [start];
    setDragStart(start);
    setDragPath([start]);
    e.preventDefault();
  }

  const boardStyle: CSSProperties = {
    position: "relative",
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, ${CELL}px)`,
    gridAutoRows: `${CELL}px`,
    gap: `${GAP}px`,
    touchAction: "none", // prevent page scroll while dragging across cells
  };

  const foundKeys = useMemo(() => {
    const s = new Set<string>();
    for (const f of foundWords) for (const p of f.path) s.add(`${p.r},${p.c}`);
    return s;
  }, [foundWords]);

  return (
    <section className="pb-6">
      <GameBar color="purple" done={found.size} total={targetSet.size} unit="found" onReset={reset} />

      {finished && (
        <DoneCard
          title="You found them all!"
          line={hiddenEmbedded ? "Read the secret message below." : "Every word is on the board."}
          color="purple"
          onAgain={reset}
        />
      )}

      <p className="mt-3 text-sm" style={{ color: "var(--color-muted)" }}>
        Slide your finger over a word. It can go any way — even backward.
      </p>

      {/* The board gets its own scroll box so the page never slides sideways. */}
      <div className="g-scroll mt-2">
        <div style={boardStyle} className="select-none">
          {Array.from({ length: rows }).flatMap((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const key = `${r},${c}`;
              const lit = foundKeys.has(key);
              return (
                <div
                  key={key}
                  data-cell-r={r}
                  data-cell-c={c}
                  onPointerDown={(e) => onCellPointerDown(r, c, e)}
                  className="g-tile cursor-pointer touch-none text-[17px]"
                  style={{
                    background: "#fff",
                    borderColor: lit ? PURPLE.base : "var(--color-line)",
                    color: lit ? PURPLE.onSoft : "var(--color-ink)",
                  }}
                  aria-label={`Letter ${grid[r][c]} at row ${r + 1} column ${c + 1}`}
                  role="button"
                  tabIndex={0}
                >
                  {grid[r][c]}
                </div>
              );
            })
          )}

          {/* Rounded highlighters, drawn over the letters. */}
          {foundWords.map((f) => (
            <Capsule key={f.word} path={f.path} color={PURPLE.base} opacity={0.24} />
          ))}
          {flashPath.length > 1 && (
            <Capsule path={flashPath} color="var(--color-coral)" opacity={0.3} />
          )}
          {dragPath.length > 1 && (
            <Capsule path={dragPath} color="var(--color-gold)" opacity={0.34} dashed />
          )}
        </div>
      </div>

      {/* Words to find, struck through as they turn up. */}
      <div className="mt-4">
        <p
          className="mb-2 font-display text-xs font-bold uppercase tracking-wide"
          style={{ color: "var(--color-muted)" }}
        >
          Words to find
        </p>
        <ul className="flex flex-wrap gap-2">
          {Array.from(targetSet).map((w) => {
            const done = found.has(w);
            return (
              <li
                key={w}
                className={
                  "rounded-full border px-3 py-1.5 font-display text-sm font-bold" +
                  (done ? " q-pop" : "")
                }
                style={
                  done
                    ? {
                        background: PURPLE.soft,
                        borderColor: PURPLE.base,
                        color: PURPLE.onSoft,
                        textDecoration: "line-through",
                      }
                    : { background: "#fff", borderColor: "var(--color-line)", color: "var(--color-ink)" }
                }
              >
                {w}
              </li>
            );
          })}
        </ul>
        {skipped.length > 0 && (
          <p className="mt-2 text-xs" style={{ color: "var(--color-muted)" }}>
            Not on the board (phrases): {skipped.join(", ")}.
          </p>
        )}
      </div>

      {messageParts.length > 0 && (
        <SecretCard parts={messageParts} revealed={revealed} unlocked={allFound} />
      )}
    </section>
  );
}

/** One rounded highlighter laid over the letters of a straight-line path. */
function Capsule({
  path,
  color,
  opacity,
  dashed = false,
}: {
  path: Cell[];
  color: string;
  opacity: number;
  dashed?: boolean;
}) {
  const a = path[0];
  const b = path[path.length - 1];
  const dx = (b.c - a.c) * STEP;
  const dy = (b.r - a.r) * STEP;
  const length = Math.hypot(dx, dy) + CELL;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: a.c * STEP,
        top: a.r * STEP,
        width: length,
        height: CELL,
        borderRadius: 999,
        background: `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`,
        border: dashed ? `2px dashed ${color}` : `2px solid ${color}`,
        transformOrigin: `${CELL / 2}px ${CELL / 2}px`,
        transform: `rotate(${angle}deg)`,
      }}
    />
  );
}

/** Running start index for each group, so no counter is mutated mid-render. */
function groupStarts(lengths: number[]): number[] {
  const out: number[] = [];
  let n = 0;
  for (const len of lengths) {
    out.push(n);
    n += len;
  }
  return out;
}

/** The hidden message: blanks until the last word is found, then it turns over. */
function SecretCard({
  parts,
  revealed,
  unlocked,
}: {
  parts: string[];
  revealed: number;
  unlocked: boolean;
}) {
  const starts = groupStarts(parts.map((p) => p.length));
  return (
    <div
      className="mt-4 rounded-card border-2 p-4"
      style={{ background: GOLD.soft, borderColor: unlocked ? GOLD.base : "var(--color-line)" }}
    >
      <p
        className="mb-2 flex items-center gap-1.5 font-display text-sm font-bold"
        style={{ color: GOLD.onSoft }}
      >
        <Icon name={unlocked ? "chest" : "lock"} size={18} />
        {unlocked ? "Secret message" : "Find every word to open this"}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {parts.map((part, g) => (
          <span key={g} className="flex gap-1">
            {part.split("").map((ch, k) => {
              const index = starts[g] + k;
              const show = index < revealed;
              return (
                <span
                  key={index}
                  className={
                    "flex h-9 w-7 items-end justify-center font-display text-xl font-bold uppercase" +
                    (show ? " g-reveal" : "")
                  }
                  style={{
                    borderBottom: `2px solid ${show ? GOLD.base : "var(--color-faint)"}`,
                    color: GOLD.onSoft,
                  }}
                >
                  {show ? ch : ""}
                </span>
              );
            })}
          </span>
        ))}
      </div>
    </div>
  );
}
