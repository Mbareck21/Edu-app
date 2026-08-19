"use client";

import AudioButton from "@/components/items/AudioButton";
import ChoiceGrid from "@/components/items/ChoiceGrid";
import ItemFrame from "@/components/items/ItemFrame";
import TypeAnswer from "@/components/items/TypeAnswer";
import type { ListenItem as ListenItemType } from "@/lib/items";
import type { ItemControlProps } from "@/components/items/props";

/** audio → word. Picking from four first, typing it once the streak allows. */
export default function ListenItem({
  item,
  locked,
  revealed,
  chosen,
  almost,
  onAnswer,
}: { item: ListenItemType } & ItemControlProps) {
  return (
    <ItemFrame prompt={item.prompt} arabic={item.arabic} glossFaded={item.glossFaded}>
      <div className="flex justify-center py-2">
        <AudioButton text={item.audioText} autoPlay size={84} />
      </div>
      {item.variant === "mcq" ? (
        <ChoiceGrid
          options={item.options}
          answer={item.answer}
          chosen={chosen}
          revealed={revealed}
          disabled={locked}
          onPick={onAnswer}
        />
      ) : (
        <TypeAnswer onSubmit={onAnswer} disabled={locked} almost={almost} />
      )}
    </ItemFrame>
  );
}

export { ListenItem };
