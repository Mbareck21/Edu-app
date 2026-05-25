"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientWord, ClientWordList, SrsState } from "@/lib/models/WordList";
import { dueWords, nextDueAt, type Rating } from "@/lib/srs";
import { celebrate, encourage } from "@/lib/feedback";
import { playTextThroughTTS, readAutoPlayPref, type Playback } from "@/lib/voice";

type SessionTally = { easy: number; hard: number };

function formatRelative(date: Date): string {
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "now";
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return `in ${Math.max(1, Math.round(ms / 60000))} min`;
  if (hours < 24) return `in ${Math.round(hours)} h`;
  return `in ${Math.round(hours / 24)} d`;
}

export default function Flashcards({ list }: { list: ClientWordList }) {
  const router = useRouter();
  const [words, setWords] = useState<ClientWord[]>(list.words);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState<null | "translating" | "reviewing">(null);
  const [error, setError] = useState<string | null>(null);
  const [tally, setTally] = useState<SessionTally>({ easy: 0, hard: 0 });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const ttsRef = useRef<Playback | null>(null);

  function stopTTS() {
    if (ttsRef.current) {
      ttsRef.current.cancel();
      ttsRef.current = null;
    }
  }

  function speak(text: string) {
    if (!readAutoPlayPref()) return;
    stopTTS();
    ttsRef.current = playTextThroughTTS(text);
  }

  // Fire-and-forget translation pass on mount if any word is missing Arabic.
  useEffect(() => {
    const needs = words.some((w) => !w.arabic);
    if (!needs) return;
    let cancelled = false;
    (async () => {
      setBusy("translating");
      setError(null);
      try {
        const res = await fetch(
          `/api/lists/${list._id}/flashcards/translate`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
        );
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          if (!cancelled) {
            setError(typeof d.error === "string" ? d.error : `Error ${res.status}`);
          }
          return;
        }
        const updated = (await res.json()) as ClientWordList;
        if (!cancelled) setWords(updated.words);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Translation failed.");
        }
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
      stopTTS();
    };
    // We only want this to run once on mount; words is intentionally not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = useMemo(() => new Date(), [words]);
  const due = useMemo(() => dueWords(words, now), [words, now]);
  const next = due[0] ?? null;

  // Auto-play English when a new card surfaces.
  useEffect(() => {
    if (!next || busy === "translating" || revealed) return;
    speak(next.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.word, busy, revealed]);

  // Auto-play Arabic when revealed.
  useEffect(() => {
    if (!next || !revealed) return;
    if (!next.arabic) return;
    speak(next.arabic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, next?.word]);

  async function rate(rating: Rating) {
    if (!next || busy) return;
    setBusy("reviewing");
    setError(null);
    try {
      const res = await fetch(`/api/lists/${list._id}/flashcards/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: next.word, rating }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(typeof d.error === "string" ? d.error : `Error ${res.status}`);
        return;
      }
      const { srs } = (await res.json()) as { srs: SrsState };
      const targetWord = next.word;
      setWords((ws) =>
        ws.map((w) => (w.word === targetWord ? { ...w, srs } : w))
      );
      setTally((t) => ({
        easy: t.easy + (rating === "easy" ? 1 : 0),
        hard: t.hard + (rating === "hard" ? 1 : 0),
      }));
      setRevealed(false);
      if (rating === "easy") celebrate({ source: cardRef.current });
      else encourage();
      // If no more due cards, refresh server state so the "All caught up"
      // panel reflects the persisted soonest-due across sessions.
      const remaining = dueWords(
        words.map((w) => (w.word === targetWord ? { ...w, srs } : w)),
        new Date()
      );
      if (remaining.length === 0) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your rating.");
    } finally {
      setBusy(null);
    }
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  if (busy === "translating") {
    return (
      <section className="card text-center space-y-2">
        <p className="text-2xl">📇</p>
        <p className="text-lg font-semibold">Preparing your flashcards…</p>
        <p className="text-sm text-slate-600">Translating words to Arabic.</p>
      </section>
    );
  }

  if (!next) {
    const upcoming = nextDueAt(words, now);
    return (
      <section className="card text-center space-y-3">
        <p className="text-3xl">🎉</p>
        <p className="text-lg font-semibold">All caught up!</p>
        {upcoming ? (
          <p className="text-sm text-slate-600">
            Next review {formatRelative(upcoming)}.
          </p>
        ) : (
          <p className="text-sm text-slate-600">No words on this list yet.</p>
        )}
        {tally.easy + tally.hard > 0 && (
          <p className="text-xs text-slate-500">
            This session: {tally.easy} easy · {tally.hard} hard.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    );
  }

  const hasArabic = !!next.arabic;

  return (
    <section className="space-y-4">
      <div
        ref={cardRef}
        onClick={() => !revealed && setRevealed(true)}
        className={
          "card flex min-h-[260px] flex-col items-center justify-center text-center select-none " +
          (revealed ? "" : "cursor-pointer hover:bg-slate-50")
        }
        role={revealed ? undefined : "button"}
        tabIndex={revealed ? undefined : 0}
        onKeyDown={(e) => {
          if (revealed) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setRevealed(true);
          }
        }}
        aria-label={revealed ? "Card revealed" : "Tap to reveal Arabic translation"}
      >
        {revealed ? (
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-wider text-slate-500">{next.word}</p>
            <p
              className="text-5xl font-bold text-slate-900"
              lang="ar"
              dir="rtl"
            >
              {hasArabic ? next.arabic : "—"}
            </p>
            {!hasArabic && (
              <p className="text-xs text-slate-500">
                No Arabic on file. Add one in the list editor.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-5xl font-bold text-slate-900">{next.word}</p>
            <p className="text-xs text-slate-500">Tap to reveal</p>
          </div>
        )}
      </div>

      {revealed && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => rate("hard")}
            disabled={busy !== null}
            className="flex-1 rounded-lg bg-rose-600 px-4 py-3 text-base font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            Hard
          </button>
          <button
            type="button"
            onClick={() => rate("easy")}
            disabled={busy !== null}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Easy
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="text-center text-xs text-slate-500">
        {due.length} due of {words.length} · this session: {tally.easy} easy / {tally.hard} hard
      </p>
    </section>
  );
}
