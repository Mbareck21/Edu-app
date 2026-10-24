"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import type { LearnerId } from "@/lib/learners";
import {
  QUARTERS,
  REPORT_ROWS,
  SCHOOL_ORF_GOALS,
  TEACHER_TOPICS,
  type QuarterId,
  type SchoolReport,
  type Score,
  type Subject,
  type TopicId,
} from "@/lib/school-report";

type Save = { state: "idle" } | { state: "saving" } | { state: "saved"; reasons: string[] } | { state: "error"; error: string };

const SUBJECTS: readonly Subject[] = ["Reading", "Writing", "Math", "Science"];
const SCORE_TONE: Record<Score, { bg: string; fg: string }> = {
  1: { bg: "var(--color-coral)", fg: "#fff" },
  2: { bg: "var(--color-gold)", fg: "var(--color-ink)" },
  3: { bg: "var(--color-green)", fg: "#fff" },
};
const SCORE_WORD: Record<Score, string> = { 1: "Emerging", 2: "Approaching", 3: "Proficient" };

type Scores = Record<string, (Score | null)[]>;

function scoresOf(report: SchoolReport): Scores {
  return Object.fromEntries(report.standards.map((s) => [s.code, [...s.scores]]));
}

/** The latest quarter anything was graded in, else the one school is in. */
function startQuarter(report: SchoolReport, now: QuarterId): QuarterId {
  for (let q = QUARTERS.length - 1; q >= 0; q--) {
    if (report.standards.some((s) => s.scores[q] !== null)) return QUARTERS[q];
  }
  return now;
}

/**
 * The report card, copied in a quarter at a time: tap 1, 2 or 3 beside each
 * standard on the card (tap again to clear), add the school's reading-speed
 * checks, and tick what the teacher wrote under work on and strengths.
 */
export default function SchoolReportForm({
  learner,
  name,
  initial,
  quarterNow,
  today,
}: {
  learner: LearnerId;
  name: string;
  initial: SchoolReport;
  quarterNow: QuarterId;
  today: string;
}) {
  const router = useRouter();
  const [quarter, setQuarter] = useState<QuarterId>(() => startQuarter(initial, quarterNow));
  const [scores, setScores] = useState<Scores>(() => scoresOf(initial));
  const [reading, setReading] = useState(initial.reading);
  const [grows, setGrows] = useState<TopicId[]>(initial.grows);
  const [glows, setGlows] = useState<TopicId[]>(initial.glows);
  const [note, setNote] = useState(initial.note);
  const [checkOn, setCheckOn] = useState(today);
  const [checkWpm, setCheckWpm] = useState("");
  const [save, setSave] = useState<Save>({ state: "idle" });
  const q = QUARTERS.indexOf(quarter);

  const graded = useMemo(
    () => Object.values(scores).filter((s) => s[q] !== null && s[q] !== undefined).length,
    [scores, q]
  );

  function setScore(code: string, score: Score) {
    setScores((all) => {
      const row = [...(all[code] ?? [null, null, null, null])];
      row[q] = row[q] === score ? null : score;
      return { ...all, [code]: row };
    });
    setSave({ state: "idle" });
  }

  function toggleTopic(id: TopicId, list: "grows" | "glows") {
    const [mine, setMine, other, setOther] =
      list === "grows" ? [grows, setGrows, glows, setGlows] : [glows, setGlows, grows, setGrows];
    if (mine.includes(id)) setMine(mine.filter((t) => t !== id));
    else {
      setMine([...mine, id]);
      if (other.includes(id)) setOther(other.filter((t) => t !== id));
    }
    setSave({ state: "idle" });
  }

  function addCheck() {
    const wpm = Number(checkWpm);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkOn) || !Number.isInteger(wpm) || wpm < 1 || wpm > 300) return;
    setReading((r) => [...r.filter((c) => c.on !== checkOn), { on: checkOn, wpm }].sort((a, b) => a.on.localeCompare(b.on)));
    setCheckWpm("");
    setSave({ state: "idle" });
  }

  async function onSave() {
    setSave({ state: "saving" });
    const report: SchoolReport = {
      year: initial.year,
      standards: Object.entries(scores)
        .filter(([, s]) => s.some((x) => x !== null))
        .map(([code, s]) => ({ code, scores: [s[0] ?? null, s[1] ?? null, s[2] ?? null, s[3] ?? null] })),
      reading,
      grows,
      glows,
      note,
    };
    try {
      const res = await fetch("/api/school-report", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learner, report }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; reasons?: string[] };
      if (!res.ok) {
        setSave({ state: "error", error: data.error ?? "Could not save. Try again." });
        return;
      }
      setSave({ state: "saved", reasons: data.reasons ?? [] });
      router.refresh();
    } catch {
      setSave({ state: "error", error: "No connection. Try again." });
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <Card>
        <h2 className="font-display text-lg font-bold">Scores</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          Pick the quarter, then tap the number on {name}&rsquo;s card beside each standard. Tap it
          again to clear. Leave a row blank if it was not graded.
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2" role="tablist" aria-label="Quarter">
          {QUARTERS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === quarter}
              onClick={() => setQuarter(id)}
              className="min-h-11 rounded-full border-2 font-display text-base font-bold"
              style={{
                borderColor: id === quarter ? "var(--color-blue)" : "var(--color-line)",
                background: id === quarter ? "var(--color-blue-soft)" : "#fff",
                color: id === quarter ? "var(--color-blue-dark)" : "var(--color-ink)",
              }}
            >
              {id}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--color-muted)" }}>
          {graded} graded in {quarter} · 3 Proficient · 2 Approaching · 1 Emerging
        </p>

        {SUBJECTS.map((subject) => (
          <section key={subject} className="mt-4">
            <h3 className="font-display text-base font-bold">{subject}</h3>
            <ul className="mt-1">
              {REPORT_ROWS.filter((r) => r.subject === subject).map((row) => {
                const current = scores[row.code]?.[q] ?? null;
                return (
                  <li key={row.code} className="border-t py-2 first:border-t-0" style={{ borderColor: "var(--color-line)" }}>
                    <p className="text-sm leading-snug">
                      {row.label}{" "}
                      <span className="whitespace-nowrap text-xs" style={{ color: "var(--color-faint)" }}>
                        {row.code}
                      </span>
                    </p>
                    <div className="mt-1.5 flex gap-2" role="group" aria-label={`${row.code} in ${quarter}`}>
                      {([1, 2, 3] as const).map((n) => {
                        const on = current === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            aria-pressed={on}
                            aria-label={`${n}, ${SCORE_WORD[n]}`}
                            onClick={() => setScore(row.code, n)}
                            className="min-h-11 min-w-11 flex-1 rounded-tile border-2 font-display text-lg font-bold"
                            style={{
                              borderColor: on ? SCORE_TONE[n].bg : "var(--color-line)",
                              background: on ? SCORE_TONE[n].bg : "#fff",
                              color: on ? SCORE_TONE[n].fg : "var(--color-muted)",
                            }}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold">Reading speed</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          Words read correctly in a minute, out loud, from the school&rsquo;s checks. School goals:{" "}
          {SCHOOL_ORF_GOALS.map((g) => `${g.wpm} by ${g.by}`).join(", ")}.
        </p>
        {reading.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {reading.map((c) => (
              <li key={c.on} className="flex min-h-11 items-center justify-between gap-2 text-base">
                <span>
                  {c.on}: <strong className="font-display">{c.wpm}</strong> words a minute
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${c.on}`}
                  onClick={() => {
                    setReading((r) => r.filter((x) => x.on !== c.on));
                    setSave({ state: "idle" });
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ color: "var(--color-muted)" }}
                >
                  <Icon name="x" size={20} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-sm font-bold">
            Date
            <input
              type="date"
              value={checkOn}
              onChange={(e) => setCheckOn(e.target.value)}
              className="mt-1 block min-h-11 w-full rounded-tile border-2 px-2 text-base"
              style={{ borderColor: "var(--color-line)", background: "#fff" }}
            />
          </label>
          <label className="w-24 text-sm font-bold">
            Words/min
            <input
              inputMode="numeric"
              value={checkWpm}
              onChange={(e) => setCheckWpm(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className="mt-1 block min-h-11 w-full rounded-tile border-2 px-2 text-base"
              style={{ borderColor: "var(--color-line)", background: "#fff" }}
            />
          </label>
          <Button size="md" variant="secondary" color="blue" onClick={addCheck} disabled={!checkWpm}>
            <Icon name="plus" size={18} />
            Add
          </Button>
        </div>
      </Card>

      {(["grows", "glows"] as const).map((list) => (
        <Card key={list}>
          <h2 className="font-display text-lg font-bold">
            {list === "grows" ? "Teacher says work on" : "Teacher says strengths"}
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            {list === "grows"
              ? "Ticked math topics come up in Today's Math."
              : "A strength takes a math topic out of catch-up, even with a low score."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {TEACHER_TOPICS.map((t) => {
              const on = (list === "grows" ? grows : glows).includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTopic(t.id, list)}
                  className="min-h-11 rounded-full border-2 px-3 text-sm font-bold"
                  style={{
                    borderColor: on ? (list === "grows" ? "var(--color-gold)" : "var(--color-green)") : "var(--color-line)",
                    background: on ? (list === "grows" ? "var(--color-gold-soft)" : "var(--color-green-soft)") : "#fff",
                    color: "var(--color-ink)",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </Card>
      ))}

      <Card>
        <label className="block font-display text-lg font-bold" htmlFor="report-note">
          Notes
        </label>
        <textarea
          id="report-note"
          value={note}
          maxLength={1000}
          rows={3}
          onChange={(e) => {
            setNote(e.target.value);
            setSave({ state: "idle" });
          }}
          className="mt-2 block w-full rounded-tile border-2 p-2 text-base"
          style={{ borderColor: "var(--color-line)", background: "#fff" }}
          placeholder="Anything else from the conference"
        />
      </Card>

      {save.state === "error" ? (
        <p className="text-sm font-bold" style={{ color: "var(--color-coral-dark)" }}>
          {save.error}
        </p>
      ) : null}
      {save.state === "saved" ? (
        <Card variant="soft" color="green">
          <p className="font-display text-base font-bold">Saved. From now on:</p>
          {save.reasons.length === 0 ? (
            <p className="mt-1 text-sm">Nothing changes: no standard is under 3 and no math topic is ticked.</p>
          ) : (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {save.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
      <Button fullWidth size="lg" color="green" onClick={onSave} disabled={save.state === "saving"}>
        {save.state === "saving" ? "Saving..." : `Save ${name}'s card`}
      </Button>
    </div>
  );
}
