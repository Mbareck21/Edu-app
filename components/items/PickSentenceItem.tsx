"use client";

import ChoiceGrid from "@/components/items/ChoiceGrid";
import ItemFrame from "@/components/items/ItemFrame";
import type { PickSentenceItem as PickSentenceItemType } from "@/lib/items";
import type { ItemControlProps } from "@/components/items/props";

/** Four sentences, one right use. Harder than a cloze — nothing is blanked. */
export default function PickSentenceItem({
  item,
  locked,
  revealed,
  chosen,
  onAnswer,
}: { item: PickSentenceItemType } & ItemControlProps) {
  return (
    <ItemFrame prompt={item.prompt} arabic={item.arabic} glossFaded={item.glossFaded}>
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

export { PickSentenceItem };
