"use client";

import ChoiceGrid from "@/components/items/ChoiceGrid";
import ItemFrame from "@/components/items/ItemFrame";
import Card from "@/components/ui/Card";
import type { WordFormItem as WordFormItemType } from "@/lib/items";
import type { ItemControlProps } from "@/components/items/props";

/** decide / decision / decisive — pick the form the sentence needs. */
export default function WordFormItem({
  item,
  locked,
  revealed,
  chosen,
  onAnswer,
}: { item: WordFormItemType } & ItemControlProps) {
  return (
    <ItemFrame prompt={item.prompt} arabic={item.arabic} glossFaded={item.glossFaded}>
      <Card color="purple" variant="soft">
        <p className="text-center font-body text-lg leading-relaxed">{item.sentence}</p>
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

export { WordFormItem };
