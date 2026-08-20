"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import GameBar from "@/components/games/GameBar";
import DoneCard from "@/components/games/DoneCard";
import Icon from "@/components/ui/Icon";
import { tone } from "@/components/ui/colors";
import type { CrosswordPlacement } from "@/lib/crossword";
import { celebrate, encourage } from "@/lib/feedback";
import { sfx } from "@/lib/sfx";

type Orientation = "across" | "down";

type CellInfo = { acrossId?: number; downId?: number };
type WordStatus = "open" | "correct" | "wrong";

const BLUE = tone("blue");
const GREEN = tone("green");
const CELL = 44;
const GAP = 3;

export default function InteractiveCrossword({
  rows,
  cols,
  grid,
  placed,
  across,
  down,
}: {
  rows: number;
  cols: number;
  grid: (string | null)[][];
  placed: CrosswordPlacement[];
  across: CrosswordPlacement[];
  down: CrosswordPlacement[];
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
  const [finished, setFinished] = useState(false);
  const finishedFiredRef = useRef(false);

  function reset() {
    setValues({});
    setWordStatus({});
    setActive(null);
    setShakeKey({});
    setFinished(false);
    finishedFiredRef.current = false;
    // Re-run the (force-dynamic) server component for a fresh word pick + layout.
    // Local state is cleared above; the refreshed grid renders into the empty board.
    router.refresh();
  }

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  // Set just before a programmatic focus so the focus handler knows which way
  // the kid meant to go — used when jumping between clues.
  const forceOrientRef = useRef<Orientation | null>(null);

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

    const forced = forceOrientRef.current;
    forceOrientRef.current = null;
    if (forced && (forced === "across" ? info.acrossId : info.downId) !== undefined) {
      setActive({ r, c, orient: forced });
      inputRefs.current.get(`${r},${c}`)?.focus();
      return;
    }

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

  /** Jump to a word from a clue tap or the arrows on the clue card. */
  function focusWord(p: CrosswordPlacement) {
    const cells = cellsOf(p);
    const target = cells.find(({ key }) => !valuesRef.current[key]) ?? cells[0];
    forceOrientRef.current = p.orientation;
    setActive({ r: target.r, c: target.c, orient: p.orientation });
    inputRefs.current.get(target.key)?.focus();
    sfx.tap();
  }

  /** Switch the active cell between its across and down word. */
  function setOrient(o: Orientation) {
    if (!active) return;
    const info = cellInfo[`${active.r},${active.c}`];
    const id = o === "across" ? info?.acrossId : info?.downId;
    if (id === undefined || active.orient === o) return;
    forceOrientRef.current = o;
    setActive({ r: active.r, c: active.c, orient: o });
    inputRefs.current.get(`${active.r},${active.c}`)?.focus();
    sfx.tap();
  }

  /** Step to the next / previous unsolved word, in clue order. */
  function stepWord(delta: 1 | -1) {
    const order = [...across, ...down];
    if (order.length === 0) return;
    const current = activeWord();
    const from = current ? order.findIndex((p) => p === current) : -1;
    const len = order.length;
    for (let i = 1; i <= len; i++) {
      const next = order[(((from + delta * i) % len) + len) % len];
      if (wordStatus[next.position] !== "correct") {
        focusWord(next);
        return;
      }
    }
  }

  function checkWord(p: CrosswordPlacement) {
    const cells = cellsOf(p);
    if (cells.some(({ key }) => !valuesRef.current[key])) return; // not full yet
    const guess = cells.map(({ key }) => valuesRef.current[key] || " ").join("").toUpperCase();
    if (guess === p.word.toUpperCase()) {
      setWordStatus((prev) => ({ ...prev, [p.position]: "correct" }));
      const firstCell = inputRefs.current.get(cells[0].key);
      sfx.correct();
      celebrate({ source: firstCell ?? undefined });
      // All-correct check.
      const updated = { ...wordStatusRef.current, [p.position]: "correct" as WordStatus };
      if (placed.every((q) => updated[q.position] === "correct") && !finishedFiredRef.current) {
        finishedFiredRef.current = true;
        setFinished(true);
        setTimeout(() => celebrate({ big: true }), 600);
      }
    } else {
      setWordStatus((prev) => ({ ...prev, [p.position]: "wrong" }));
      setShakeKey((prev) => ({ ...prev, [p.position]: (prev[p.position] ?? 0) + 1 }));
      if (wordStatusRef.current[p.position] !== "wrong") {
        sfx.wrong();
        encourage();
      }
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
  const activeCells = activePlacement
    ? new Set(cellsOf(activePlacement).map((x) => x.key))
    : new Set<string>();
  const solved = placed.filter((p) => wordStatus[p.position] === "correct").length;
  const activeInfo = active ? cellInfo[`${active.r},${active.c}`] : undefined;

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, ${CELL}px)`,
    gridAutoRows: `${CELL}px`,
    gap: `${GAP}px`,
  };

  return (
    <section className="pb-40">
      <GameBar color="blue" done={solved} total={placed.length} unit="solved" onReset={reset} />

      {finished && (
        <DoneCard
          title="Puzzle done!"
          line="You filled in every word."
          color="green"
          onAgain={reset}
        />
      )}

      <p className="mt-3 text-sm" style={{ color: "var(--color-muted)" }}>
        Tap a box and type. Tap it again to swap across and down.
      </p>

      {/* The grid gets its own scroll box so the page never slides sideways. */}
      <div className="g-scroll mt-2">
        <div style={gridStyle}>
          {Array.from({ length: rows }).flatMap((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const key = `${r},${c}`;
              const cell = grid[r][c];
              if (cell === null) return <div key={key} />;

              const info = cellInfo[key];
              const pos = posNumMap.get(key);
              const isCorrect =
                (info?.acrossId !== undefined && wordStatus[info.acrossId] === "correct") ||
                (info?.downId !== undefined && wordStatus[info.downId] === "correct");
              const isActiveCell = active?.r === r && active?.c === c;
              const inActiveWord = activeCells.has(key);
              const isWrong =
                (info?.acrossId !== undefined && wordStatus[info.acrossId] === "wrong") ||
                (info?.downId !== undefined && wordStatus[info.downId] === "wrong");
              const wordShakeKey =
                info?.acrossId !== undefined && wordStatus[info.acrossId] === "wrong"
                  ? shakeKey[info.acrossId] ?? 0
                  : info?.downId !== undefined && wordStatus[info.downId] === "wrong"
                    ? shakeKey[info.downId] ?? 0
                    : 0;

              const look: CSSProperties = isCorrect
                ? { background: GREEN.base, borderColor: GREEN.dark, color: "#fff" }
                : isActiveCell
                  ? {
                      background: "#fff",
                      borderColor: BLUE.base,
                      borderWidth: 2.5,
                      boxShadow: "0 0 0 3px color-mix(in srgb, var(--color-blue) 26%, transparent)",
                      color: "var(--color-ink)",
                    }
                  : inActiveWord
                    ? { background: BLUE.soft, borderColor: BLUE.base, color: BLUE.onSoft }
                    : { background: "#fff", borderColor: "var(--color-line)", color: "var(--color-ink)" };

              return (
                <div
                  key={key}
                  className={
                    "g-tile relative" +
                    (isCorrect ? " q-pop" : "") +
                    (isWrong && wordShakeKey > 0 ? " q-shake" : "")
                  }
                  style={look}
                  data-shake={wordShakeKey}
                >
                  {pos !== undefined && (
                    <span
                      className="pointer-events-none absolute left-1 top-0.5 font-body text-[10px] font-bold leading-none"
                      style={{ color: isCorrect ? "rgba(255,255,255,0.85)" : "var(--color-faint)" }}
                    >
                      {pos}
                    </span>
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
                    className="h-full w-full rounded-[10px] bg-transparent text-center font-display text-xl font-bold uppercase focus:outline-none disabled:opacity-100"
                    style={{ color: "inherit" }}
                    aria-label={`Cell row ${r + 1} column ${c + 1}`}
                    disabled={isCorrect}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Clue lists — tap one to jump to its word. */}
      <div className="mt-4 space-y-4">
        <CluesList
          title="Across"
          entries={across}
          wordStatus={wordStatus}
          activeId={activePlacement?.orientation === "across" ? activePlacement.position : null}
          onPick={focusWord}
        />
        <CluesList
          title="Down"
          entries={down}
          wordStatus={wordStatus}
          activeId={activePlacement?.orientation === "down" ? activePlacement.position : null}
          onPick={focusWord}
        />
      </div>

      {/* The clue for the word being typed, parked above the keyboard. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto max-w-app px-3 pb-3">
        <div
          className="pointer-events-auto rounded-card border-2 p-3 shadow-lift"
          style={{ background: "#fff", borderColor: BLUE.base }}
        >
          {activePlacement ? (
            <>
              <div className="flex items-center gap-2">
                <span
                  className="flex h-8 min-w-8 items-center justify-center rounded-full px-2 font-display text-sm font-bold"
                  style={{ background: BLUE.base, color: BLUE.on }}
                >
                  {activePlacement.position}
                </span>
                <OrientChip
                  label="Across"
                  on={activePlacement.orientation === "across"}
                  available={activeInfo?.acrossId !== undefined}
                  onClick={() => setOrient("across")}
                />
                <OrientChip
                  label="Down"
                  on={activePlacement.orientation === "down"}
                  available={activeInfo?.downId !== undefined}
                  onClick={() => setOrient("down")}
                />
                <span className="flex-1" />
                <StepButton label="Previous clue" icon="arrowLeft" onClick={() => stepWord(-1)} />
                <StepButton label="Next clue" icon="arrowRight" onClick={() => stepWord(1)} />
              </div>
              <p className="mt-2 font-display text-lg font-bold leading-snug">
                {activePlacement.clue || `${activePlacement.word.length} letters`}
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span style={{ color: BLUE.base }}>
                <Icon name="sparkles" size={22} />
              </span>
              <p className="font-display text-base font-bold" style={{ color: "var(--color-muted)" }}>
                Tap a box to see its clue.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function OrientChip({
  label,
  on,
  available,
  onClick,
}: {
  label: string;
  on: boolean;
  available: boolean;
  onClick: () => void;
}) {
  if (!available) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="h-9 rounded-full px-3 font-display text-xs font-bold uppercase tracking-wide"
      style={
        on
          ? { background: BLUE.soft, color: BLUE.onSoft }
          : { background: "var(--color-sand)", color: "var(--color-faint)" }
      }
    >
      {label}
    </button>
  );
}

function StepButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: "arrowLeft" | "arrowRight";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border-2"
      style={{ borderColor: "var(--color-line)", color: BLUE.onSoft }}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

function CluesList({
  title,
  entries,
  wordStatus,
  activeId,
  onPick,
}: {
  title: string;
  entries: CrosswordPlacement[];
  wordStatus: Record<number, WordStatus>;
  activeId: number | null;
  onPick: (p: CrosswordPlacement) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p
        className="mb-2 font-display text-xs font-bold uppercase tracking-wide"
        style={{ color: "var(--color-muted)" }}
      >
        {title}
      </p>
      <ul className="space-y-1.5">
        {entries.map((e) => {
          const done = wordStatus[e.position] === "correct";
          const isActive = activeId === e.position;
          return (
            <li key={e.position}>
              <button
                type="button"
                onClick={() => onPick(e)}
                className="flex w-full items-start gap-2 rounded-tile border px-3 py-2 text-left text-sm"
                style={{
                  background: isActive ? BLUE.soft : done ? GREEN.soft : "#fff",
                  borderColor: isActive ? BLUE.base : "var(--color-line)",
                  color: done ? GREEN.onSoft : "var(--color-ink)",
                  textDecoration: done ? "line-through" : undefined,
                }}
              >
                <span className="font-display font-bold">{e.position}.</span>
                <span className="flex-1">{e.clue || `${e.word.length} letters`}</span>
                {done && (
                  <span style={{ color: GREEN.base }}>
                    <Icon name="check" size={18} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
