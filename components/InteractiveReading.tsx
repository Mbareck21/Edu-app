"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ClientWordList, ReadingQuestion } from "@/lib/models/WordList";
import { celebrate, encourage } from "@/lib/feedback";

type Progress = {
  currentIdx: number;
  wrongCount: number[];
  hintsUsed: number[];
  revealed: boolean[];
  done: boolean;
};

const HINT_AT = [2, 4]; // reveal hint 1 after 2 wrongs, hint 2 after 4 wrongs
const REVEAL_AT = HINT_AT[1] + 2; // show the answer after 2 more wrongs past hint 2

function stripArticle(s: string): string {
  return s.replace(/^(a|an|the)\s+/, "");
}

function isCorrect(userAnswer: string, acceptable: readonly string[]): boolean {
  const aRaw = userAnswer.trim().toLowerCase();
  if (!aRaw) return false;
  const a = stripArticle(aRaw);
  return acceptable.some((acc) => {
    const bRaw = acc.trim().toLowerCase();
    if (!bRaw) return false;
    const b = stripArticle(bRaw);
    if (a === b) return true;
    if (a.length >= 2 && b.includes(a)) return true;
    if (b.length >= 2 && a.includes(b)) return true;
    return false;
  });
}

function progressKey(listId: string, generatedAt: string): string {
  return `eduapp.reading.${listId}.${generatedAt}`;
}

function cleanupOldProgress(listId: string): void {
  if (typeof window === "undefined") return;
  const prefix = `eduapp.reading.${listId}.`;
  const toDelete: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(prefix)) toDelete.push(key);
  }
  for (const k of toDelete) window.localStorage.removeItem(k);
}

function renderParagraphWithVocab(
  paragraph: string,
  glosses: Map<string, string>
): ReactNode {
  if (glosses.size === 0) return paragraph;
  // Split on alphabetic runs, capturing them so punctuation + whitespace
  // survive in their original positions.
  const parts = paragraph.split(/([A-Za-z]+)/g);
  return parts.map((tok, i) => {
    if (!tok) return null;
    if (/^[A-Za-z]+$/.test(tok)) {
      const lower = tok.toLowerCase();
      const arabic =
        glosses.get(lower) ?? glosses.get(lower.replace(/s$/, ""));
      if (arabic) {
        return (
          <span
            key={i}
            tabIndex={0}
            className="group relative inline-block bg-amber-100 border-b-2 border-dotted border-amber-700 rounded-sm px-0.5 cursor-help focus:outline-none focus:bg-amber-200"
          >
            {tok}
            <span
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 -translate-y-1 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-sm text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 z-10"
              lang="ar"
              dir="rtl"
            >
              {arabic}
            </span>
          </span>
        );
      }
    }
    return <Fragment key={i}>{tok}</Fragment>;
  });
}

export default function InteractiveReading({ list }: { list: ClientWordList }) {
  const router = useRouter();
  const reading = list.currentReading;
  const questions = reading?.questions ?? [];

  const glossMap = useMemo(
    () =>
      new Map(
        (reading?.vocabGlosses ?? [])
          .filter((g) => g.word && g.arabic)
          .map((g) => [g.word.toLowerCase(), g.arabic])
      ),
    [reading?.vocabGlosses]
  );

  const storageKey = reading ? progressKey(list._id, reading.generatedAt) : null;

  const [progress, setProgress] = useState<Progress>(() => {
    if (!reading || typeof window === "undefined") {
      return { currentIdx: 0, wrongCount: [], hintsUsed: [], revealed: [], done: false };
    }
    const raw = window.localStorage.getItem(progressKey(list._id, reading.generatedAt));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<Progress>;
        if (parsed && Array.isArray(parsed.wrongCount) && Array.isArray(parsed.hintsUsed)) {
          // `revealed` was added later; tolerate old localStorage entries.
          const revealed = Array.isArray(parsed.revealed)
            ? parsed.revealed
            : questions.map(() => false);
          return {
            currentIdx: parsed.currentIdx ?? 0,
            wrongCount: parsed.wrongCount,
            hintsUsed: parsed.hintsUsed,
            revealed,
            done: parsed.done ?? false,
          };
        }
      } catch {
        // fall through
      }
    }
    return {
      currentIdx: 0,
      wrongCount: questions.map(() => 0),
      hintsUsed: questions.map(() => 0),
      revealed: questions.map(() => false),
      done: false,
    };
  });

  // Persist progress whenever it changes.
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  }, [storageKey, progress]);

  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<"" | "wrong">("");
  const [busy, setBusy] = useState<null | "generating" | "completing">(null);
  const [error, setError] = useState<string | null>(null);
  const completionFiredRef = useRef(false);

  async function generate() {
    if (
      reading &&
      !progress.done &&
      (progress.currentIdx > 0 || progress.wrongCount.some((n) => n > 0))
    ) {
      if (!window.confirm("Start a new reading? Your progress on this one will be lost.")) return;
    }
    setError(null);
    setBusy("generating");
    try {
      const res = await fetch("/api/reading/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: list._id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : `Error ${res.status}`);
        return;
      }
      cleanupOldProgress(list._id);
      completionFiredRef.current = false;
      setProgress({ currentIdx: 0, wrongCount: [], hintsUsed: [], revealed: [], done: false });
      setValue("");
      setFeedback("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function completeSession(finalProgress: Progress) {
    if (!reading || completionFiredRef.current) return;
    completionFiredRef.current = true;
    const perQuestion = questions.map((q, i) => ({
      type: q.type,
      firstTryCorrect: (finalProgress.wrongCount[i] ?? 0) === 0 && (finalProgress.hintsUsed[i] ?? 0) === 0,
      hintsUsed: finalProgress.hintsUsed[i] ?? 0,
    }));
    setBusy("completing");
    try {
      await fetch("/api/reading/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: list._id, perQuestion }),
      });
      cleanupOldProgress(list._id);
      celebrate({ big: true });
      // Give the celebration a moment, then refresh to reset the page state.
      setTimeout(() => router.refresh(), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your progress.");
    } finally {
      setBusy(null);
    }
  }

  const check = (e: { preventDefault: () => void; currentTarget: EventTarget & HTMLFormElement }) => {
    e.preventDefault();
    if (!reading || progress.done || busy) return;
    const idx = progress.currentIdx;
    const q = questions[idx];
    if (!q) return;
    const ok = isCorrect(value, q.acceptable);
    if (ok) {
      const card = (e.currentTarget.closest("[data-q-card]") as HTMLElement | null) ?? undefined;
      celebrate({ source: card });
      const nextIdx = idx + 1;
      const isLast = nextIdx >= questions.length;
      const next: Progress = {
        ...progress,
        currentIdx: isLast ? idx : nextIdx,
        done: isLast,
      };
      setProgress(next);
      setValue("");
      setFeedback("");
      if (isLast) void completeSession(next);
    } else {
      const nextWrong = (progress.wrongCount[idx] ?? 0) + 1;
      // Auto-reveal hints based on wrong-count thresholds.
      let hints = progress.hintsUsed[idx] ?? 0;
      if (nextWrong >= HINT_AT[0] && hints < 1) hints = 1;
      if (nextWrong >= HINT_AT[1] && hints < 2) hints = 2;
      const wrongArr = [...progress.wrongCount];
      wrongArr[idx] = nextWrong;
      const hintArr = [...progress.hintsUsed];
      hintArr[idx] = hints;
      const revealedArr = [...progress.revealed];
      if (nextWrong >= REVEAL_AT) revealedArr[idx] = true;
      setProgress({ ...progress, wrongCount: wrongArr, hintsUsed: hintArr, revealed: revealedArr });
      setFeedback("wrong");
      // Voice encouragement only on the first wrong attempt per question.
      if (nextWrong === 1) encourage();
      setTimeout(() => setFeedback(""), 450);
    }
  };

  // Advance after the kid taps "Got it" on a revealed answer. No celebration —
  // the question already counts as wrong via its existing wrongCount.
  const acknowledgeReveal = () => {
    if (!reading || progress.done || busy) return;
    const idx = progress.currentIdx;
    const nextIdx = idx + 1;
    const isLast = nextIdx >= questions.length;
    const next: Progress = {
      ...progress,
      currentIdx: isLast ? idx : nextIdx,
      done: isLast,
    };
    setProgress(next);
    setValue("");
    setFeedback("");
    if (isLast) void completeSession(next);
  };

  // ── Rendering ────────────────────────────────────────────────────────────

  if (!reading) {
    return (
      <section className="card space-y-3">
        <p className="text-base text-slate-700">
          Tap below to generate a short story using the words from <strong>{list.name}</strong>.
          You will read it and answer 4 questions.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={generate}
          disabled={busy !== null}
          className="btn-primary"
        >
          {busy === "generating" ? "📖 Writing your story…" : "📖 Generate new reading"}
        </button>
      </section>
    );
  }

  const currentIdx = progress.done ? questions.length - 1 : progress.currentIdx;
  const q: ReadingQuestion | undefined = questions[currentIdx];
  const revealedHints = q ? Math.min(progress.hintsUsed[currentIdx] ?? 0, q.hints.length) : 0;
  const isRevealed = !!progress.revealed[currentIdx];
  const revealedAnswer = q?.acceptable[0] ?? "";

  return (
    <section className="space-y-4">
      {/* Title + paragraph */}
      {reading.title && (
        <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">
          {reading.title}
        </h2>
      )}
      <article className="card text-lg leading-relaxed whitespace-pre-wrap">
        {renderParagraphWithVocab(reading.paragraph, glossMap)}
      </article>

      {/* Question (or completion message) */}
      {progress.done ? (
        <div className="card text-center space-y-2">
          <p className="text-2xl">🎉</p>
          <p className="text-lg font-semibold">You finished the reading!</p>
          <p className="text-sm text-slate-600">
            {busy === "completing" ? "Saving your score…" : "Loading your stats…"}
          </p>
        </div>
      ) : q ? (
        <div
          data-q-card
          className={"card space-y-3 " + (feedback === "wrong" ? "ws-shake" : "")}
        >
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Question {currentIdx + 1} of {questions.length}
          </p>
          <p className="text-base font-medium">{q.q}</p>
          {isRevealed ? (
            <div className="space-y-3">
              <div className="rounded border border-sky-300 bg-sky-50 p-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-800">
                  The answer was
                </p>
                <p className="text-base text-sky-900">{revealedAnswer}</p>
              </div>
              <button type="button" onClick={acknowledgeReveal} className="btn-primary">
                Got it — next question
              </button>
            </div>
          ) : (
            <>
              <form className="flex gap-2" onSubmit={check}>
                <input
                  className="input flex-1"
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Type your answer…"
                  disabled={busy !== null}
                />
                <button type="submit" className="btn-primary" disabled={busy !== null || !value.trim()}>
                  Check
                </button>
              </form>
              {revealedHints > 0 && (
                <div className="rounded border border-amber-300 bg-amber-50 p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Hint</p>
                  {q.hints.slice(0, revealedHints).map((h, i) => (
                    <p key={i} className="text-sm text-amber-900">{h}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Generate-new button always available, useful if the kid wants to skip or after completion */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={generate}
          disabled={busy !== null}
          className="btn-secondary"
        >
          {busy === "generating" ? "Writing…" : "📖 New reading"}
        </button>
      </div>

      {/* Progress dots */}
      {!progress.done && (
        <div className="flex justify-center gap-1.5">
          {questions.map((_, i) => {
            const cls =
              "h-2 w-2 rounded-full " +
              (i < currentIdx ? "bg-emerald-500" : i === currentIdx ? "bg-slate-700" : "bg-slate-300");
            return <span key={i} className={cls} aria-hidden />;
          })}
        </div>
      )}
    </section>
  );
}
