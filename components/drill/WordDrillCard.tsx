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
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";

export type WordDrillCardProps = {
  lists: { listId: string; name: string; count: number }[];
  all: number;
  weak: number;
  due: number;
};

/** One screen: where the words come from, what to do with them, how many. */
export default function WordDrillCard({ lists, all, weak, due }: WordDrillCardProps) {
  const router = useRouter();
  const firstList = lists[0]?.listId ?? "";
  const [src, setSrc] = useState<string>(all > 0 ? "all" : "");
  const [mode, setMode] = useState<VocabMode>("mixed");
  const [count, setCount] = useState<number>(10);
  const [going, setGoing] = useState(false);

  const oneList = needsOneList(mode);
  const listChoices: Choice[] = lists.map((l) => ({
    value: `list:${l.listId}`,
    label: l.name,
    note: String(l.count),
    disabled: l.count === 0,
  }));
  const sourceChoices: Choice[] = oneList
    ? listChoices
    : [
        { value: "all", label: "All words", note: String(all), disabled: all === 0 },
        ...listChoices,
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

  const ready = all > 0 && src !== "" && (!oneList || src.startsWith("list:"));

  function start() {
    if (!ready || going) return;
    setGoing(true);
    router.push(
      vocabHref({ source: parseSource(src), mode, count, seed: Date.now() })
    );
  }

  return (
    <Card className="mt-4">
      <div className="flex items-center gap-2">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "var(--color-blue-soft)", color: "var(--color-blue)" }}
        >
          <Icon name="words" size={20} />
        </span>
        <h2 className="font-display text-xl font-bold">Word drills</h2>
      </div>

      {all === 0 ? (
        <p className="mt-2 font-body text-sm" style={{ color: "var(--color-muted)" }}>
          Add a word list first, then come back.
        </p>
      ) : (
        <>
          <ChoiceRow label="Words" choices={sourceChoices} value={src} onChange={setSrc} />
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
    </Card>
  );
}

export { WordDrillCard };
