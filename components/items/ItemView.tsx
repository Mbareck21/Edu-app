"use client";

import ClozeItem from "@/components/items/ClozeItem";
import ContextClueItem from "@/components/items/ContextClueItem";
import LearnCard from "@/components/items/LearnCard";
import ListenItem from "@/components/items/ListenItem";
import PickSentenceItem from "@/components/items/PickSentenceItem";
import RecognizeItem from "@/components/items/RecognizeItem";
import SentenceCombineItem from "@/components/items/SentenceCombineItem";
import SpellItem from "@/components/items/SpellItem";
import WordFormItem from "@/components/items/WordFormItem";
import WordPartBuildItem from "@/components/items/WordPartBuildItem";
import WordPartMeaningItem from "@/components/items/WordPartMeaningItem";
import WriteItem from "@/components/items/WriteItem";
import type { LessonItem } from "@/lib/items";
import type { ItemControlProps } from "@/components/items/props";

export type ItemViewProps = ItemControlProps & {
  item: LessonItem;
  /** Learn cards have nothing to answer — this moves on. */
  onContinue: () => void;
};

/** One item, whichever kind it is. */
export default function ItemView({ item, onContinue, ...controls }: ItemViewProps) {
  switch (item.kind) {
    case "learn-card":
      return <LearnCard item={item} onContinue={onContinue} />;
    case "recognize":
      return <RecognizeItem item={item} {...controls} />;
    case "listen":
      return <ListenItem item={item} {...controls} />;
    case "spell":
      return <SpellItem item={item} {...controls} />;
    case "write":
      return <WriteItem item={item} {...controls} />;
    case "use-cloze":
      return <ClozeItem item={item} {...controls} />;
    case "use-pick-sentence":
      return <PickSentenceItem item={item} {...controls} />;
    case "use-word-form":
      return <WordFormItem item={item} {...controls} />;
    case "word-part-meaning":
      return <WordPartMeaningItem item={item} {...controls} />;
    case "word-part-build":
      return <WordPartBuildItem item={item} {...controls} />;
    case "context-clue":
      return <ContextClueItem item={item} {...controls} />;
    case "sentence-combine":
      return <SentenceCombineItem item={item} {...controls} />;
  }
}

export { ItemView };
