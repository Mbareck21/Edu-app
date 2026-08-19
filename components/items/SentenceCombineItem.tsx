"use client";

import ChoiceGrid from "@/components/items/ChoiceGrid";
import ItemFrame from "@/components/items/ItemFrame";
import Card from "@/components/ui/Card";
import type { SentenceCombineItem as SentenceCombineItemType } from "@/lib/items";
import type { ItemControlProps } from "@/components/items/props";

/** 4.L.14.S — join two sentences with because / although / when. */
export default function SentenceCombineItem({
  item,
  locked,
  revealed,
  chosen,
  onAnswer,
}: { item: SentenceCombineItemType } & ItemControlProps) {
  return (
    <ItemFrame prompt={item.prompt}>
      <Card color="purple" variant="soft" className="space-y-1 text-center">
        <p className="font-body text-lg leading-snug">{item.first}</p>
        <p className="font-display text-sm font-bold" style={{ color: "var(--color-purple-dark)" }}>
          +
        </p>
        <p className="font-body text-lg leading-snug">{item.second}</p>
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

export { SentenceCombineItem };
