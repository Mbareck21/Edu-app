"use client";

import ChoiceGrid from "@/components/items/ChoiceGrid";
import ItemFrame from "@/components/items/ItemFrame";
import Card from "@/components/ui/Card";
import type { WordPartMeaningItem as WordPartMeaningItemType } from "@/lib/items";
import type { ItemControlProps } from "@/components/items/props";

/** 4.FR.1.PD — what does this prefix, base or suffix mean? */
export default function WordPartMeaningItem({
  item,
  locked,
  revealed,
  chosen,
  onAnswer,
}: { item: WordPartMeaningItemType } & ItemControlProps) {
  return (
    <ItemFrame prompt={item.prompt}>
      <Card color="gold" variant="soft" className="text-center">
        <p className="font-display text-4xl font-bold lowercase">{item.part}</p>
        <p
          className="mt-1 font-display text-xs font-bold uppercase tracking-widest"
          style={{ color: "var(--color-gold-ink)" }}
        >
          {item.partKind}
        </p>
        {item.examples.length > 0 ? (
          <p className="mt-2 font-body text-sm" style={{ color: "var(--color-muted)" }}>
            {item.examples.join(" · ")}
          </p>
        ) : null}
      </Card>
      <ChoiceGrid
        options={item.options}
        answer={item.answer}
        chosen={chosen}
        revealed={revealed}
        disabled={locked}
        onPick={onAnswer}
        layout="sentences"
      />
    </ItemFrame>
  );
}

export { WordPartMeaningItem };
