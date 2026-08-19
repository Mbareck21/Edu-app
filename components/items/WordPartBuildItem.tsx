"use client";

import ChoiceGrid from "@/components/items/ChoiceGrid";
import ItemFrame from "@/components/items/ItemFrame";
import Card from "@/components/ui/Card";
import type { WordPartBuildItem as WordPartBuildItemType } from "@/lib/items";
import type { ItemControlProps } from "@/components/items/props";

/** 4.FR.1.PD / 4.FR.4.PE — add the part that carries the meaning. */
export default function WordPartBuildItem({
  item,
  locked,
  revealed,
  chosen,
  onAnswer,
}: { item: WordPartBuildItemType } & ItemControlProps) {
  return (
    <ItemFrame prompt={item.prompt}>
      <Card color="gold" variant="soft" className="text-center">
        <p className="font-display text-3xl font-bold lowercase">
          {item.lead}
          <span style={{ color: "var(--color-gold-ink)" }}> + ?</span>
        </p>
        <p className="mt-2 font-body text-[15px]">
          Add the part that means <strong>{item.partMeaning}</strong>.
        </p>
      </Card>
      <ChoiceGrid
        options={item.tiles}
        answer={item.answer}
        chosen={chosen}
        revealed={revealed}
        disabled={locked}
        onPick={onAnswer}
      />
    </ItemFrame>
  );
}

export { WordPartBuildItem };
