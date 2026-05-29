"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { CrosswordPlacement } from "@/lib/crossword";
import { celebrate, encourage } from "@/lib/feedback";
import ResetButton from "@/components/ResetButton";

type Orientation = "across" | "down";

type CellInfo = { acrossId?: number; downId?: number };
type WordStatus = "open" | "correct" | "wrong";

export default function InteractiveCrossword({
  rows,
  cols,
  grid,
  placed,
  across,
  down,
  listName,
}: {
  rows: number;
  cols: number;
  grid: (string | null)[][];
  placed: CrosswordPlacement[];
  across: CrosswordPlacement[];
  down: CrosswordPlacement[];
  listName: string;
}) {
  const router = useRouter();

  // Cell-info lookup: position → which across/down word goes through it.
  const cellInfo = useMemo(() => {
    const map: Record<string, CellInfo> = {};
    for (const p of placed) {
      for (let i = 0; i < p.word.length; i++) {
        const r = p.startRow + (p.orientation === "down" ? i : 0);
        const c = p.startCol + (p.orientation === "across" ? i : 0);
        const key = `${r},${c}`;
        map[key] ??= {};
        if (p.orientation === "across") map[key].acrossId = p.position;
        else map[key].downId = p.position;
      }
    }
    return map;
  }, [placed]);

  // Position-number map (corner number per starting cell).
  const posNumMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of placed) m.set(`${p.startRow},${p.startCol}`, p.position);
    return m;
  }, [placed]);

  // Per-cell value state.
  const [values, setValues] = useState<Record<string, string>>({});
  // Per-word completion state.
  const [wordStatus, setWordStatus] = useState<Record<number, WordStatus>>({});
  // Active selection.
  const [active, setActive] = useState<{ r: number; c: number; orient: Orientation } | null>(null);
  // Shake key per word for re-trigger.
  const [shakeKey, setShakeKey] = useState<Record<number, number>>({});
  const finishedFiredRef = useRef(false);

  function reset() {
    setValues({});
    setWordStatus({});
    setActive(null);
    setShakeKey({});
    finishedFiredRef.current = false;
    // Re-run the (force-dynamic) server component for a fresh word pick + layout.
    // Local state is cleared above; the refreshed grid renders into the empty board.
    router.refresh();
  }

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Refs to read latest values inside handlers without re-render churn.
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const wordStatusRef = useRef(wordStatus);
  wordStatusRef.current = wordStatus;

  const placedById = useMemo(() => {
    const m = new Map<number, CrosswordPlacement>();
    for (const p of placed) m.set(p.position, p);
    return m;
  }, [placed]);

  function cellsOf(p: CrosswordPlacement): { r: number; c: number; key: string }[] {
    const out: { r: number; c: number; key: string }[] = [];
    for (let i = 0; i < p.word.length; i++) {
      const r = p.startRow + (p.orientation === "down" ? i : 0);
      const c = p.startCol + (p.orientation === "across" ? i : 0);
      out.push({ r, c, key: `${r},${c}` });
    }
    return out;
  }

  function activeWord(): CrosswordPlacement | null {
    if (!active) return null;
    const info = cellInfo[`${active.r},${active.c}`];
    if (!info) return null;
    const id = active.orient === "across" ? info.acrossId : info.downId;
    if (id === undefined) {
      // Fall back to the other orientation if only one exists.
      const other = active.orient === "across" ? info.downId : info.acrossId;
      return other !== undefined ? placedById.get(other) ?? null : null;
    }
    return placedById.get(id) ?? null;
  }

  function selectCell(r: number, c: number) {
    const info = cellInfo[`${r},${c}`];
    if (!info) return;
    let orient: Orientation;

    if (active && active.r === r && active.c === c) {
      // Same cell → toggle orientation if both directions are available here.
      if (info.acrossId !== undefined && info.downId !== undefined) {
        orient = active.orient === "across" ? "down" : "across";
      } else {
        orient = info.acrossId !== undefined ? "across" : "down";
      }
    } else {
      // New cell. Two-pass preference:
      //   1. Continuity — if the new cell is in the same active word, keep
      //      orient. This catches programmatic focus from auto-advance, even
      //      when the new cell happens to be the start of a perpendicular word.
      //   2. Starts here — if the new cell is the STARTING cell of one word
      //      but only a crossing cell of the other, prefer the one that starts
      //      here (clear user intent).
      //   3. Fallback — prior orient if compatible, else default to across.
      const acrossWord = info.acrossId !== undefined ? placedById.get(info.acrossId) ?? null : null;
      const downWord = info.downId !== undefined ? placedById.get(info.downId) ?? null : null;
      const prefer = active?.orient;
      const prevInfo = active ? cellInfo[`${active.r},${active.c}`] : undefined;

      if (
        prefer === "across" &&
        acrossWord &&
        prevInfo?.acrossId === acrossWord.position
      ) {
        orient = "across";
      } else if (
        prefer === "down" &&
        downWord &&
        prevInfo?.downId === downWord.position
      ) {
        orient = "down";
      } else {
        const startsAcross = !!acrossWord && acrossWord.startRow === r && acrossWord.startCol === c;
        const startsDown = !!downWord && downWord.startRow === r && downWord.startCol === c;
        if (startsDown && !startsAcross) orient = "down";
        else if (startsAcross && !startsDown) orient = "across";
        else if (prefer === "across" && acrossWord) orient = "across";
        else if (prefer === "down" && downWord) orient = "down";
        else orient = acrossWord ? "across" : "down";
      }
    }

    setActive({ r, c, orient });
    inputRefs.current.get(`${r},${c}`)?.focus();
  }

  function checkWord(p: CrosswordPlacement) {
    const cells = cellsOf(p);
    if (cells.some(({ key }) => !valuesRef.current[key])) return; // not full yet
    const guess = cells.map(({ key }) => valuesRef.current[key] || " ").join("").toUpperCase();
    if (guess === p.word.toUpperCase()) {
      setWordStatus((prev) => ({ ...prev, [p.position]: "correct" }));
      const firstCell = inputRefs.current.get(cells[0].key);
      celebrate({ source: firstCell ?? undefined });
      // All-correct check.
      const updated = { ...wordStatusRef.current, [p.position]: "correct" as WordStatus };
      if (placed.every((q) => updated[q.position] === "correct") && !finishedFiredRef.current) {
        finishedFiredRef.current = true;
        setTimeout(() => celebrate({ big: true }), 600);
      }
    } else {
      setWordStatus((prev) => ({ ...prev, [p.position]: "wrong" }));
      setShakeKey((prev) => ({ ...prev, [p.position]: (prev[p.position] ?? 0) + 1 }));
      if (wordStatusRef.current[p.position] !== "wrong") encourage();
    }
  }

  function isLocked(r: number, c: number): boolean {
    const info = cellInfo[`${r},${c}`];
    if (!info) return false;
    if (info.acrossId !== undefined && wordStatus[info.acrossId] === "correct") return true;
    if (info.downId !== undefined && wordStatus[info.downId] === "correct") return true;
    return false;
  }

  function onCellInput(r: number, c: number, raw: string) {
    const key = `${r},${c}`;
    // Block edit if any word through this cell is locked correct.
    const info = cellInfo[key];
    if (isLocked(r, c)) return;

    // Strip to one letter A-Z.
    const ch = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(-1);
    setValues((prev) => ({ ...prev, [key]: ch }));
    // Clear any wrong status on the words this cell belongs to (give a fresh try).
    if (info?.acrossId !== undefined && wordStatus[info.acrossId] === "wrong") {
      setWordStatus((prev) => ({ ...prev, [info.acrossId!]: "open" }));
    }
    if (info?.downId !== undefined && wordStatus[info.downId] === "wrong") {
      setWordStatus((prev) => ({ ...prev, [info.downId!]: "open" }));
    }

    if (ch) {
      // Auto-advance to the next EMPTY cell of the active word — skip over
      // intersection cells already filled by a previous word, so the kid
      // doesn't get stuck at every crossing.
      const word = activeWord();
      if (word) {
        const dr = word.orientation === "down" ? 1 : 0;
        const dc = word.orientation === "across" ? 1 : 0;
        let r2 = r + dr;
        let c2 = c + dc;
        while (cellInfo[`${r2},${c2}`] && valuesRef.current[`${r2},${c2}`]) {
          r2 += dr;
          c2 += dc;
        }
        const nextKey = `${r2},${c2}`;
        if (cellInfo[nextKey]) {
          setActive({ r: r2, c: c2, orient: word.orientation });
          inputRefs.current.get(nextKey)?.focus();
        } else {
          // Walked off the word — validate (useEffect on values also re-checks).
          setTimeout(() => checkWord(word), 0);
        }
      }
    }
  }

  function onCellKeyDown(r: number, c: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      const key = `${r},${c}`;
      if (!values[key]) {
        // Empty cell → step back to previous EDITABLE cell of active word,
        // skipping any locked cells (intersecting correct words).
        const word = activeWord();
        if (word) {
          const dr = word.orientation === "down" ? -1 : 0;
          const dc = word.orientation === "across" ? -1 : 0;
          let r2 = r + dr;
          let c2 = c + dc;
          while (cellInfo[`${r2},${c2}`] && isLocked(r2, c2)) {
            r2 += dr;
            c2 += dc;
          }
          const prevKey = `${r2},${c2}`;
          if (cellInfo[prevKey]) {
            e.preventDefault();
            setActive({ r: r2, c: c2, orient: word.orientation });
            inputRefs.current.get(prevKey)?.focus();
          }
        }
      }
    }
  }

  // When active orientation changes, attempt to check the just-completed word
  // if the user filled the last cell manually.
  useEffect(() => {
    const word = activeWord();
    if (word) checkWord(word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const activePlacement = activeWord();
  const activeCells = activePlacement ? new Set(cellsOf(activePlacement).map((x) => x.key)) : new Set<string>();

  const CELL = 44;
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, ${CELL}px)`,
    gridAutoRows: `${CELL}px`,
  };

  return (
    <section className="space-y-4">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold">Crossword</h1>
          <ResetButton onReset={reset} confirmMessage="Start a new puzzle? Your progress will be cleared." />
        </div>
        <p className="text-sm text-slate-600">{listName}</p>
      </div>

      {/* Active clue banner */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 min-h-14">
        {activePlacement ? (
          <p className="text-base">
            <strong className="mr-2 uppercase text-slate-500 text-sm">
              {activePlacement.position} {activePlacement.orientation}
            </strong>
            {activePlacement.clue || `(${activePlacement.word.length} letters)`}
          </p>
        ) : (
          <p className="text-sm text-slate-500">Tap a cell to start. Tap the same cell again to switch between Across and Down.</p>
        )}
      </div>

      {/* Grid */}
      <div className="print-center">
        <div className="inline-grid border-2 border-black" style={gridStyle}>
          {Array.from({ length: rows }).flatMap((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const key = `${r},${c}`;
              const cell = grid[r][c];
              if (cell === null) {
                return <div key={key} className="bg-black" />;
              }
              const info = cellInfo[key];
              const pos = posNumMap.get(key);
              const status = (() => {
                if (info?.acrossId !== undefined && wordStatus[info.acrossId] === "correct") return "correct";
                if (info?.downId !== undefined && wordStatus[info.downId] === "correct") return "correct";
                return "open";
              })();
              const isActive = activeCells.has(key);
              const wordShakeKey =
                info?.acrossId !== undefined && wordStatus[info.acrossId] === "wrong"
                  ? shakeKey[info.acrossId] ?? 0
                  : info?.downId !== undefined && wordStatus[info.downId] === "wrong"
                    ? shakeKey[info.downId] ?? 0
                    : 0;
              const cls =
                "relative flex items-center justify-center border border-black " +
                (status === "correct" ? "ws-correct " : "") +
                (isActive && status !== "correct" ? "ws-active " : "");
              return (
                <div
                  key={key}
                  className={cls + (wordShakeKey > 0 ? "ws-shake" : "")}
                  data-shake={wordShakeKey}
                >
                  {pos !== undefined && (
                    <span className="ws-num absolute left-0.5 top-0 font-normal leading-none text-slate-700">{pos}</span>
                  )}
                  <input
                    ref={(el) => {
                      if (el) inputRefs.current.set(key, el);
                      else inputRefs.current.delete(key);
                    }}
                    value={values[key] || ""}
                    onChange={(e) => onCellInput(r, c, e.target.value)}
                    onKeyDown={(e) => onCellKeyDown(r, c, e)}
                    onFocus={() => selectCell(r, c)}
                    onClick={() => selectCell(r, c)}
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="h-full w-full bg-transparent text-center text-xl font-bold uppercase focus:outline-none"
                    aria-label={`Cell row ${r + 1} column ${c + 1}`}
                    disabled={status === "correct"}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Clues list */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <CluesList
          title="ACROSS"
          entries={across}
          wordStatus={wordStatus}
          activeId={activePlacement?.orientation === "across" ? activePlacement.position : null}
        />
        <CluesList
          title="DOWN"
          entries={down}
          wordStatus={wordStatus}
          activeId={activePlacement?.orientation === "down" ? activePlacement.position : null}
        />
      </div>
    </section>
  );
}

function CluesList({
  title,
  entries,
  wordStatus,
  activeId,
}: {
  title: string;
  entries: CrosswordPlacement[];
  wordStatus: Record<number, WordStatus>;
  activeId: number | null;
}) {
  return (
    <div>
      <h2 className="mb-2 border-b border-slate-300 pb-1 text-center text-sm font-bold tracking-wider">{title}</h2>
      <ol className="space-y-1.5 text-sm">
        {entries.map((e) => {
          const status = wordStatus[e.position];
          const isActive = activeId === e.position;
          return (
            <li
              key={e.position}
              className={
                (status === "correct" ? "text-emerald-700 line-through " : "") +
                (isActive ? "bg-yellow-100 rounded px-1 " : "")
              }
            >
              <strong>{e.position}.</strong> {e.clue || `(${e.word.length} letters)`}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
