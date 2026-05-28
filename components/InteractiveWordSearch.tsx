"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { celebrate, encourage } from "@/lib/feedback";
import ResetButton from "@/components/ResetButton";

type Cell = { r: number; c: number };

export default function InteractiveWordSearch({
  rows,
  cols,
  grid,
  words,
  listName,
  skipped = [],
}: {
  rows: number;
  cols: number;
  grid: string[][];
  words: string[];      // canonical, lowercase, letters-only
  listName: string;
  skipped?: string[];
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

  const [found, setFound] = useState<Set<string>>(() => new Set());
  const [foundCellKeys, setFoundCellKeys] = useState<Set<string>>(() => new Set());

  // Drag selection state. `dragStart` non-null means a drag is in progress.
  // `dragPath` is the current straight-line selection from start through the
  // cell currently under the finger. `flashPath` is the brief red-flash on miss.
  const [dragStart, setDragStart] = useState<Cell | null>(null);
  const [dragPath, setDragPath] = useState<Cell[]>([]);
  const [flashKeys, setFlashKeys] = useState<Set<string>>(() => new Set());

  // Refs the document-level pointer listeners read each move/up. State alone
  // would give the listeners stale closures.
  const dragStartRef = useRef<Cell | null>(null);
  const dragPathRef = useRef<Cell[]>([]);
  const flashTimerRef = useRef<number | null>(null);
  const finishedFiredRef = useRef(false);

  function reset() {
    setFound(new Set());
    setFoundCellKeys(new Set());
    setDragStart(null);
    setDragPath([]);
    setFlashKeys(new Set());
    dragStartRef.current = null;
    dragPathRef.current = [];
    finishedFiredRef.current = false;
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

  function flashRed(cells: Cell[]) {
    const keys = new Set(cells.map((c) => `${c.r},${c.c}`));
    setFlashKeys(keys);
    if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlashKeys(new Set()), 400);
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
      setFound((prev) => new Set(prev).add(winning));
      setFoundCellKeys((prev) => {
        const next = new Set(prev);
        for (const p of path) next.add(`${p.r},${p.c}`);
        return next;
      });
      // Confetti from the first cell of the path.
      const firstEl = document.querySelector(
        `[data-cell-r="${path[0].r}"][data-cell-c="${path[0].c}"]`
      ) as HTMLElement | null;
      celebrate({ source: firstEl ?? undefined });
      const allFound = Array.from(targetSet).every((w) => w === winning || found.has(w));
      if (allFound && !finishedFiredRef.current) {
        finishedFiredRef.current = true;
        setTimeout(() => celebrate({ big: true }), 600);
      }
    } else {
      flashRed(path);
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

  const CELL = 36;
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, ${CELL}px)`,
    gridAutoRows: `${CELL}px`,
    touchAction: "none", // prevent page scroll while dragging across cells
  };

  const dragKeys = useMemo(() => {
    const s = new Set<string>();
    for (const p of dragPath) s.add(`${p.r},${p.c}`);
    return s;
  }, [dragPath]);

  return (
    <section className="space-y-4">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold">Word Search</h1>
          <ResetButton onReset={reset} />
        </div>
        <p className="text-sm text-slate-600">{listName}</p>
        <p className="mt-2 text-sm text-slate-700">
          <strong>Slide your finger</strong> across the letters of a word — in any of 8 directions. Release on the last letter.
        </p>
      </div>

      <div className="print-center">
        <div className="inline-grid border-2 border-black font-mono select-none" style={gridStyle}>
          {Array.from({ length: rows }).flatMap((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const key = `${r},${c}`;
              const isFound = foundCellKeys.has(key);
              const isDragging = dragKeys.has(key);
              const isFlash = flashKeys.has(key);
              const cls =
                "flex items-center justify-center border border-black uppercase select-none cursor-pointer touch-none " +
                (isFound ? "ws-found " : "") +
                (isDragging && !isFound ? "ws-active " : "") +
                (isFlash ? "ws-wrong ws-shake " : "");
              return (
                <div
                  key={key}
                  data-cell-r={r}
                  data-cell-c={c}
                  onPointerDown={(e) => onCellPointerDown(r, c, e)}
                  className={cls}
                  aria-label={`Letter ${grid[r][c]} at row ${r + 1} column ${c + 1}`}
                  role="button"
                  tabIndex={0}
                >
                  {grid[r][c]}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded border border-slate-300 p-3">
        <p className="mb-2 text-center text-sm font-bold tracking-wider">WORDS TO FIND</p>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-base sm:grid-cols-3 md:grid-cols-4">
          {Array.from(targetSet).map((w) => (
            <li key={w} className={found.has(w) ? "ws-strike text-emerald-700" : ""}>
              {w}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Found {found.size} of {targetSet.size}
        </p>
        {skipped.length > 0 && (
          <p className="mt-1 text-xs text-amber-700">
            Skipped (phrases / non-letters): {skipped.join(", ")}.
          </p>
        )}
      </div>
    </section>
  );
}
