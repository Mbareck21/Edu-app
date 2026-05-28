"use client";

import { useRef, useState } from "react";
import { celebrate, encourage } from "@/lib/feedback";
import ResetButton from "@/components/ResetButton";

type RowState = {
  scrambled: string;
  answer: string;
  value: string;
  status: "idle" | "correct" | "wrong";
  wrongCount: number;
  revealed: boolean;
  shakeKey: number;
};

export default function InteractiveScramble({
  listName,
  rows: initial,
}: {
  listName: string;
  rows: { scrambled: string; answer: string }[];
}) {
  const buildRows = (): RowState[] =>
    initial.map((r) => ({
      scrambled: r.scrambled,
      answer: r.answer,
      value: "",
      status: "idle",
      wrongCount: 0,
      revealed: false,
      shakeKey: 0,
    }));
  const [rows, setRows] = useState<RowState[]>(buildRows);
  const finishedFiredRef = useRef(false);

  function reset() {
    setRows(buildRows());
    finishedFiredRef.current = false;
  }

  function updateValue(i: number, value: string) {
    setRows((prev) =>
      prev.map((r, idx) =>
        idx === i ? { ...r, value: value.toUpperCase(), status: r.status === "correct" ? r.status : "idle" } : r
      )
    );
  }

  function check(i: number, ev: React.MouseEvent<HTMLButtonElement>) {
    const r = rows[i];
    if (r.status === "correct") return;
    const guess = r.value.trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (!guess) return;
    const source = ev.currentTarget.closest("li") as HTMLElement | null;
    // Compare letters-only so phrase answers ("CLIMATE CHANGE") accept the
    // kid typing either "climate change" or "climatechange".
    const answerLetters = r.answer.replace(/[^A-Z]/g, "");

    if (guess === answerLetters) {
      setRows((prev) => prev.map((x, idx) => (idx === i ? { ...x, status: "correct", value: guess } : x)));
      celebrate({ source });
      // Check overall completion.
      const allDone = rows.every((x, idx) => (idx === i ? true : x.status === "correct"));
      if (allDone && !finishedFiredRef.current) {
        finishedFiredRef.current = true;
        setTimeout(() => celebrate({ big: true }), 600);
      }
    } else {
      setRows((prev) =>
        prev.map((x, idx) =>
          idx === i ? { ...x, status: "wrong", wrongCount: x.wrongCount + 1, shakeKey: x.shakeKey + 1 } : x
        )
      );
      if (r.wrongCount === 0) encourage();
    }
  }

  function reveal(i: number) {
    setRows((prev) => prev.map((x, idx) => (idx === i ? { ...x, value: x.answer, status: "correct", revealed: true } : x)));
  }

  return (
    <section>
      <div className="mb-1 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold">Word Scramble</h1>
        <ResetButton onReset={reset} />
      </div>
      <p className="mb-1 text-sm text-slate-600">{listName}</p>
      <p className="mb-6 text-sm text-slate-700">Type each word and tap <strong>Check</strong>.</p>
      <ol className="space-y-3">
        {rows.map((r, i) => {
          const inputCls =
            "input text-center uppercase tracking-widest font-bold text-xl flex-1 min-w-32 " +
            (r.status === "correct" ? "ws-correct" : r.status === "wrong" ? "ws-wrong" : "");
          return (
            <li
              key={i}
              className={"flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 " +
                (r.status === "wrong" ? "ws-shake" : "")}
              style={r.status === "wrong" ? { animationName: "ws-shake" } : undefined}
              data-shake={r.shakeKey}
            >
              <span className="scramble-scrambled font-bold min-w-32">{r.scrambled}</span>
              <input
                className={inputCls}
                value={r.value}
                onChange={(e) => updateValue(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.currentTarget.parentElement?.querySelector("button[data-check]") as HTMLButtonElement)?.click();
                  }
                }}
                disabled={r.status === "correct"}
                placeholder={"?".repeat(r.answer.length)}
                aria-label={`Unscramble ${r.scrambled}`}
                maxLength={r.answer.length + 4}
              />
              <button
                type="button"
                data-check
                onClick={(e) => check(i, e)}
                disabled={r.status === "correct" || !r.value.trim()}
                className="btn-primary"
              >
                {r.status === "correct" ? "✓" : "Check"}
              </button>
              {r.wrongCount >= 2 && !r.revealed && r.status !== "correct" && (
                <button
                  type="button"
                  onClick={() => reveal(i)}
                  className="text-xs text-slate-500 hover:text-slate-900 underline"
                >
                  Show answer
                </button>
              )}
              {r.revealed && <span className="text-xs text-slate-500">(answer shown)</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
