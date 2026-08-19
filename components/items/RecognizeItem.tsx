"use client";

import ChoiceGrid from "@/components/items/ChoiceGrid";
import ItemFrame from "@/components/items/ItemFrame";
import Card from "@/components/ui/Card";
import type { RecognizeItem as RecognizeItemType } from "@/lib/items";
import type { ItemControlProps } from "@/components/items/props";

/** meaning → word. The first rung of the ladder. */
export default function RecognizeItem({
  item,
  locked,
  revealed,
  chosen,
  onAnswer,
}: { item: RecognizeItemType } & ItemControlProps) {
  return (
    <ItemFrame prompt={item.prompt} arabic={item.arabic} glossFaded={item.glossFaded}>
      <Card color="blue" variant="soft">
        <p className="text-center font-body text-lg leading-snug">{item.clue}</p>
      </Card>
      <ChoiceGrid
        options={item.options}
        answer={item.answer}
        chosen={chosen}
        revealed={revealed}
        disabled={locked}
        onPick={onAnswer}
      />
    </ItemFrame>
  );
}

export { RecognizeItem };
