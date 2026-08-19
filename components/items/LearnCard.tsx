"use client";

import AudioButton from "@/components/items/AudioButton";
import ArabicChip from "@/components/items/ArabicChip";
import { Marked } from "@/components/items/ItemFrame";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { LearnCardItem } from "@/lib/items";

/** New word, day one. Nothing to answer — read it, hear it, then go. */
export default function LearnCard({
  item,
  onContinue,
}: {
  item: LearnCardItem;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <p
        className="font-display text-xs font-bold uppercase tracking-widest"
        style={{ color: "var(--color-blue)" }}
      >
        New word
      </p>

      <Card color="blue" variant="soft" className="text-center">
        <p className="font-display text-4xl font-bold lowercase">{item.word}</p>
        <p className="mt-2 font-body text-base" style={{ color: "var(--color-ink)" }}>
          {item.explanation}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <AudioButton text={item.word} autoPlay size={64} />
          <ArabicChip arabic={item.arabic ?? ""} faded={item.glossFaded} />
        </div>
      </Card>

      {item.examples.length > 0 ? (
        <div className="space-y-2">
          <p
            className="font-display text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            How we use it
          </p>
          {item.examples.map((example, i) => (
            <Card key={i} padded={false} className="px-4 py-3">
              <p className="font-body text-[15px] leading-snug">
                <Marked text={example} word={item.word} />
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      {item.family.length > 0 ? (
        <div className="space-y-2">
          <p
            className="font-display text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            Word family
          </p>
          <div className="flex flex-wrap gap-2">
            {item.family.map((form) => (
              <span
                key={form}
                className="rounded-full px-3 py-1.5 font-display text-sm font-bold"
                style={{ background: "var(--color-sand)", color: "var(--color-ink)" }}
              >
                {form}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <Button color="blue" size="lg" fullWidth onClick={onContinue}>
        Got it
      </Button>
    </div>
  );
}

export { LearnCard };
