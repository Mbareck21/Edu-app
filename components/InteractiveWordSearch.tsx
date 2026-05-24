"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { celebrate, encourage } from "@/lib/feedback";

type Cell = { r: number; c: number };

export default function InteractiveWordSearch({
  rows,
  cols,
  grid,
  words,
  listName,
}: {
  rows: number;
  cols: number;
  grid: string[][];
  words: string[];      // canonical, lowercase, letters-only
  listName: string;
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
  const [firstTap, setFirstTap] = useState<Cell | null>(null);
  const [flashCells, setFlashCells] = useState<Set<string>>(() => new Set());
  const flashTimerRef = useRef<number | null>(null);
  const finishedFiredRef = useRef(false);

  function flashRed(cells: Cell[]) {
    const keys = new Set(cells.map((c) => `${c.r},${c.c}`));
    setFlashCells(keys);
    if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlashCells(new Set()), 400);
  }

  // Compute straight-line cells between two endpoints inclusive, or null if
  // they don't lie on a shared 8-direction line.
  function pathBetween(a: Cell, b: Cell): Cell[] | null {
    const dr = b.r - a.r;
    const dc = b.c - a.c;
    if (dr === 0 && dc === 0) return null;
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

  function tap(r: number, c: number, el: HTMLElement | null) {
    if (!firstTap) {
      setFirstTap({ r, c });
      return;
    }
    if (firstTap.r === r && firstTap.c === c) {
      // Same cell — cancel selection.
      setFirstTap(null);
      return;
    }
    const path = pathBetween(firstTap, { r, c });
    setFirstTap(null);
    if (!path) {
      flashRed([{ r, c }, firstTap!]);
      if (firstTap) encourage();
      return;
    }
    const word = path.map((p) => grid[p.r][p.c]).join("").toUpperCase();
    const reversed = word.split("").reverse().join("");
    let hit: string | null = null;
    if (targetSet.has(word) && !found.has(word)) hit = word;
    else if (targetSet.has(reversed) && !found.has(reversed)) hit = reversed;

    if (hit) {
      setFound((prev) => new Set(prev).add(hit!));
      setFoundCellKeys((prev) => {
        const next = new Set(prev);
        for (const p of path) next.add(`${p.r},${p.c}`);
        return next;
      });
      celebrate({ source: el ?? undefined });
      // All-found check.
      const allFound = Array.from(targetSet).every((w) => w === hit || found.has(w));
      if (allFound && !finishedFiredRef.current) {
        finishedFiredRef.current = true;
        setTimeout(() => celebrate({ big: true }), 600);
      }
    } else {
      flashRed(path);
      // Don't burn voice on every wrong tap — encourage only sometimes.
      if (Math.random() < 0.35) encourage();
    }
  }

  const CELL = 36;
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, ${CELL}px)`,
    gridAutoRows: `${CELL}px`,
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Word Search</h1>
        <p className="text-sm text-slate-600">{listName}</p>
        <p className="mt-2 text-sm text-slate-700">
          Tap the <strong>first letter</strong> of a word, then tap its <strong>last letter</strong>. Words can go in 8 directions.
        </p>
      </div>

      <div className="print-center">
        <div className="inline-grid border-2 border-black font-mono" style={gridStyle}>
          {Array.from({ length: rows }).flatMap((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const key = `${r},${c}`;
              const isFound = foundCellKeys.has(key);
              const isFirst = firstTap?.r === r && firstTap?.c === c;
              const isFlash = flashCells.has(key);
              const cls =
                "flex items-center justify-center border border-black uppercase select-none cursor-pointer " +
                (isFound ? "ws-found " : "") +
                (isFirst && !isFound ? "ws-active " : "") +
                (isFlash ? "ws-wrong ws-shake " : "");
              return (
                <button
                  type="button"
                  key={key}
                  onClick={(e) => tap(r, c, e.currentTarget as HTMLElement)}
                  className={cls}
                  aria-label={`Letter ${grid[r][c]} at row ${r + 1} column ${c + 1}`}
                >
                  {grid[r][c]}
                </button>
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
      </div>
    </section>
  );
}
