"use client";

import AudioButton from "@/components/items/AudioButton";
import ItemFrame from "@/components/items/ItemFrame";
import TileBuilder from "@/components/items/TileBuilder";
import Card from "@/components/ui/Card";
import type { SpellItem as SpellItemType } from "@/lib/items";
import type { ItemControlProps } from "@/components/items/props";

/** Build the word from letter tiles. The rung below typed dictation. */
export default function SpellItem({
  item,
  locked,
  onAnswer,
}: { item: SpellItemType } & ItemControlProps) {
  return (
    <ItemFrame prompt={item.prompt} arabic={item.arabic} glossFaded={item.glossFaded}>
      <Card variant="soft" className="flex items-center gap-3">
        <AudioButton text={item.audioText} size={56} />
        <p className="min-w-0 flex-1 font-body text-[15px] leading-snug">{item.hint}</p>
      </Card>
      <TileBuilder tiles={item.tiles} onSubmit={onAnswer} disabled={locked} />
    </ItemFrame>
  );
}

export { SpellItem };
