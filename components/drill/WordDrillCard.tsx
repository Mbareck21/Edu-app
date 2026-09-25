"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import ChoiceRow, { type Choice } from "@/components/drill/ChoiceRow";
import {
  DRILL_LENGTHS,
  VOCAB_MODES,
  VOCAB_MODE_BLURB,
  VOCAB_MODE_LABEL,
  needsOneList,
  parseSource,
  vocabHref,
  type VocabMode,
} from "@/components/drill/options";
import Button from "@/components/ui/Button";
import DrillFoldTitle from "@/components/drill/DrillFoldTitle";
import Fold from "@/components/ui/Fold";

export type WordDrillCardProps = {
  lists: { listId: string; name: string; total: number; toGo: number }[];
  /** Words still to learn across every list. */
  all: number;
  /** Every word, learned or not — the drill can still run on a finished list. */
  total: number;
  weak: number;
  due: number;
};

/** One screen: where the words come from, what to do with them, how many. */
export default function WordDrillCard({ lists, all, total, weak, due }: WordDrillCardProps) {
  const router = useRouter();
  const firstList = lists[0]?.listId ?? "";
  const [src, setSrc] = useState<string>(total > 0 ? "all" : "");
  const [mode, setMode] = useState<VocabMode>("mixed");
  const [count, setCount] = useState<number>(10);
  const [going, setGoing] = useState(false);

  const oneList = needsOneList(mode);
  // "14 to go" rather than "22": a list he has mastered reads "done" and has
  // already been sorted to the bottom, instead of looking untouched.
  const listChoices: Choice[] = lists.map((l) => ({
    value: `list:${l.listId}`,
    // "School: " opens most names; on a phone it only pushed the rest off the line.
    label: l.name.replace(/^School:\s*/i, ""),
    note: l.toGo === 0 ? "done" : `${l.toGo} to go`,
    disabled: l.total === 0,
  }));
  // The mixes are short, so they stay chips; the lists get a row each.
  const mixChoices: Choice[] = [
    { value: "all", label: "All words", note: all === 0 ? "all done" : `${all} to go`, disabled: total === 0 },
    { value: "weak", label: "Weak", note: String(weak), disabled: weak === 0 },
    { value: "due", label: "Due now", note: String(due), disabled: due === 0 },
  ];

  // "Remember" only works on one list, so switching to it moves the source.
  function chooseMode(next: string) {
    const picked = next as VocabMode;
    setMode(picked);
    if (needsOneList(picked) && !src.startsWith("list:")) {
      setSrc(firstList ? `list:${firstList}` : "");
    }
  }

  const ready = total > 0 && src !== "" && (!oneList || src.startsWith("list:"));

  function start() {
    if (!ready || going) return;
    setGoing(true);
    router.push(
      vocabHref({ source: parseSource(src), mode, count, seed: Date.now() })
    );
  }

  return (
    <Fold
      className="mt-4"
      title={
        <DrillFoldTitle
          icon="words"
          color="blue"
          title="Word drills"
          line={total === 0 ? "No words yet" : all > 0 ? `${all} words to go · ${weak} weak` : "Every word known. Keep them sharp!"}
        />
      }
    >

      {/* `all` is only what is left to learn; once every word is known it hits
          zero, and the picker must stay so he can still drill them. */}
      {total === 0 ? (
        <p className="mt-2 font-body text-sm" style={{ color: "var(--color-muted)" }}>
          Add a word list first, then come back.
        </p>
      ) : (
        <>
          {oneList ? null : (
            <ChoiceRow label="Words" choices={mixChoices} value={src} onChange={setSrc} />
          )}
          <ChoiceRow
            label={oneList ? "Words" : "Or one list"}
            choices={listChoices}
            value={src}
            onChange={setSrc}
            layout="list"
          />
          <ChoiceRow
            label="Drill"
            choices={VOCAB_MODES.map((m) => ({ value: m, label: VOCAB_MODE_LABEL[m] }))}
            value={mode}
            onChange={chooseMode}
          />
          <p className="mt-1.5 font-body text-sm" style={{ color: "var(--color-muted)" }}>
            {VOCAB_MODE_BLURB[mode]}
          </p>
          {mode === "remember" ? null : (
            <ChoiceRow
              label="How many"
              choices={DRILL_LENGTHS.map((n) => ({ value: String(n), label: String(n) }))}
              value={String(count)}
              onChange={(v) => setCount(Number(v))}
            />
          )}
          <Button
            className="mt-4"
            color="blue"
            size="lg"
            fullWidth
            disabled={!ready || going}
            onClick={start}
          >
            Start
          </Button>
        </>
      )}
    </Fold>
  );
}

export { WordDrillCard };
