"use client";

import ChoiceGrid from "@/components/items/ChoiceGrid";
import ItemFrame, { Marked } from "@/components/items/ItemFrame";
import Card from "@/components/ui/Card";
import type { ContextClueItem as ContextClueItemType } from "@/lib/items";
import type { ItemControlProps } from "@/components/items/props";

/** 4.V.2 — work the meaning out from the sentence around the word. */
export default function ContextClueItem({
  item,
  locked,
  revealed,
  chosen,
  onAnswer,
}: { item: ContextClueItemType } & ItemControlProps) {
  return (
    <ItemFrame prompt={item.prompt} arabic={item.arabic} glossFaded={item.glossFaded}>
      <Card color="gold" variant="soft">
        <p className="text-center font-body text-lg leading-relaxed">
          <Marked text={item.sentence} word={item.word ?? ""} />
        </p>
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

export { ContextClueItem };
