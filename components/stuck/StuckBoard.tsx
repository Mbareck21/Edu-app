"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ChainRunner, { chainResumeKey, isChainSaved } from "@/components/stuck/ChainRunner";
import { useSavedRun } from "@/components/ui/useSavedRun";
import type { WordSense } from "@/components/stuck/ChainRunner";
import {
  CHAIN_TARGET,
  ROTATE_WIDTH,
  checkDue,
  newChain,
  splitStuck,
  type ChainState,
} from "@/lib/spell-chain";
import type { ClientWordList } from "@/lib/models/WordList";

export type StuckBoardProps = {
  list: ClientWordList;
  chains: Record<string, ChainState>;
};

/**
 * The Words tab: what he is stuck on, what he has finished, and the way in.
 *
 * The parent adds words here too, because he adds them at the moment his son
 * is stuck — mid-homework, one hand on the worksheet. Hiding that behind the
 * Me tab would mean the word never gets typed at all.
 */
/**
 * A sitting on the Words tab pays XP like the writing drill: it is the same
 * work, and it used to pay nothing.
 */
const STUCK_REF = "stuck:write";

export default function StuckBoard(props: StuckBoardProps & { locked?: boolean }) {
  // A sitting that was under way when the page reloaded comes straight back.
  const saved = useSavedRun(chainResumeKey(STUCK_REF), isChainSaved);
  const resumed = props.locked ? null : (saved?.words ?? null);
  return <StuckBoardInner key={resumed ? "resumed" : "fresh"} {...props} resumed={resumed} />;
}

function StuckBoardInner({
  list,
  chains,
  resumed,
  locked = false,
}: StuckBoardProps & {
  resumed: string[] | null;
  /** A child: the words to fix, without a sitting of its own. The suggested drill writes them (lib/assigned.ts). */
  locked?: boolean;
}) {
  const [words, setWords] = useState(list.words.map((w) => w.word));
  const [senses, setSenses] = useState<Record<string, WordSense>>(() =>
    Object.fromEntries(list.words.map((w) => [w.word, { clue: w.clue, arabic: w.arabic }]))
  );
  const [state, setState] = useState(chains);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState<string[] | null>(resumed);

  // "Finished" is not forever. A word that hit ten comes back for one blind
  // write on the spacing ladder; when that falls due it is a working word
  // again until he passes it, and a miss puts it back to zero. Past the 20
  // newest unfinished words, the older ones wait (see splitStuck).
  const nowIso = new Date().toISOString();
  const { working, waiting, finished } = splitStuck(words, state, nowIso);
  // Due checks first — each needs one write and then leaves the sitting —
  // then the words still being learned, which rotate for the rest of it.
  const checks = working.filter((w) => state[w] && checkDue(state[w], nowIso));
  const learning = working.filter((w) => !checks.includes(w));
  const sitting = [...checks, ...learning.slice(0, ROTATE_WIDTH)];

  async function add() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/stuck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(typeof data.error === "string" ? data.error : "That did not save.");
        return;
      }
      const rows: { word: string; clue: string; arabic: string }[] = data.list.words;
      const next = rows.map((w) => w.word);
      setWords(next);
      setSenses(Object.fromEntries(rows.map((w) => [w.word, { clue: w.clue, arabic: w.arabic }])));
      setState((s) => {
        const out = { ...s };
        for (const w of next) {
          if (!out[w]) {
            out[w] = newChain(w);
          }
        }
        return out;
      });
      setText("");
      const parts: string[] = [];
      if (data.added.length > 0) parts.push(`Added ${data.added.join(", ")}.`);
      if (data.alreadyThere.length > 0) parts.push(`${data.alreadyThere.join(", ")} was already here.`);
      // Never swallow one: the parent must see what did not take.
      if (data.rejected.length > 0) parts.push(`Could not use: ${data.rejected.join(", ")}.`);
      setNote(parts.join(" ") || null);
    } catch {
      setNote("That did not save. Check the internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (running) {
    return (
      <div className="-mx-4">
        <ChainRunner
          words={running}
          senses={senses}
          chains={state}
          post={{ ref: STUCK_REF }}
          onDone={() => {
            setRunning(null);
            // The counts moved on the server; take the page again so the board
            // and the drill can never show different numbers.
            window.location.reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <Card color="blue" variant="soft">
        <label htmlFor="stuck-add" className="font-display text-base font-bold">
          Add a word he is stuck on
        </label>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          One, or several at once — separate them with commas or new lines.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            id="stuck-add"
            className="min-h-[52px] min-w-0 flex-1 rounded-tile border-2 px-3 text-base"
            style={{ borderColor: "var(--color-line)", background: "#fff" }}
            placeholder="fifty, thirty, eighty"
            value={text}
            autoCapitalize="none"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
          />
          <Button size="md" color="blue" disabled={!text.trim() || busy} onClick={() => void add()}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </div>
        {note ? <p className="mt-2 text-sm">{note}</p> : null}
      </Card>

      {working.length > 0 && locked ? (
        <p className="text-center text-base" style={{ color: "var(--color-muted)" }}>
          Your suggested drill on the Drill tab practises these words.
        </p>
      ) : working.length > 0 ? (
        <div>
          <Button
            fullWidth
            size="lg"
            color="green"
            onClick={() => setRunning(sitting)}
          >
            Start writing
          </Button>
          <p className="mt-2 text-center text-sm" style={{ color: "var(--color-muted)" }}>
            {[
              checks.length > 0 ? `${checks.length} to check` : "",
              learning.length > 0
                ? `${Math.min(learning.length, ROTATE_WIDTH)} to write, taking turns`
                : "",
            ]
              .filter(Boolean)
              .join(" · ") || "One word to fix."}
          </p>
        </div>
      ) : (
        <p className="text-center text-base" style={{ color: "var(--color-muted)" }}>
          {words.length === 0
            ? "No stuck words yet. Add one above when he gets one wrong."
            : "Every word is finished. Add another when one comes up."}
        </p>
      )}

      {working.length > 0 ? (
        <Card padded={false} className="overflow-hidden">
          <ul className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {working.map((w) => {
              const c = state[w];
              const done = c?.current ?? 0;
              const due = c ? checkDue(c, nowIso) : false;
              return (
                <li key={w} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold leading-tight">{w}</p>
                    {senses[w]?.clue ? (
                      <p className="truncate text-xs" style={{ color: "var(--color-muted)" }}>
                        {senses[w].clue}
                      </p>
                    ) : null}
                  </div>
                  <div className="w-24 shrink-0 text-right">
                    <p className="text-xs font-bold" style={{ color: due ? "var(--color-gold-ink)" : "var(--color-muted)" }}>
                      {due ? "Check again" : `${done}/${CHAIN_TARGET}${c && c.best > done ? ` · best ${c.best}` : ""}`}
                    </p>
                    <div className="mt-1 flex gap-0.5" aria-hidden>
                      {Array.from({ length: CHAIN_TARGET }, (_, i) => (
                        <span
                          key={i}
                          className="h-1.5 flex-1 rounded-full"
                          style={{
                            background:
                              i < done
                                ? "var(--color-blue)"
                                : i < (c?.best ?? 0)
                                  ? "var(--color-blue-soft)"
                                  : "var(--color-line)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {waiting.length > 0 ? (
        <details>
          <summary className="cursor-pointer py-3 text-sm font-bold" style={{ color: "var(--color-muted)" }}>
            {waiting.length} waiting — they come in as you finish these
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {waiting.map((w) => (
              <span
                key={w}
                className="rounded-full px-3 py-2 text-sm font-bold"
                style={{ background: "var(--color-line)", color: "var(--color-muted)" }}
              >
                {w}
              </span>
            ))}
          </div>
        </details>
      ) : null}

      {finished.length > 0 ? (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
            Finished
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {finished.map((w) => (
              <span
                key={w}
                className="rounded-full px-3 py-2 text-sm font-bold"
                style={{ background: "var(--color-green-soft)", color: "var(--color-green-dark)" }}
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { StuckBoard };
