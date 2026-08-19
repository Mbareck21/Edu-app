"use client";

import AudioButton from "@/components/items/AudioButton";
import ItemFrame from "@/components/items/ItemFrame";
import TypeAnswer from "@/components/items/TypeAnswer";
import Card from "@/components/ui/Card";
import type { WriteItem as WriteItemType } from "@/lib/items";
import type { ItemControlProps } from "@/components/items/props";

/** Letters he missed come back red; the rest stay black. */
function Spelled({ answer, typed }: { answer: string; typed: string }) {
  const given = typed.trim().toLowerCase();
  return (
    <p className="text-center font-display text-3xl font-bold tracking-[0.18em] lowercase">
      {answer.split("").map((letter, i) => (
        <span
          key={i}
          style={{
            color: given[i] === letter ? "var(--color-ink)" : "var(--color-coral-dark)",
          }}
        >
          {letter}
        </span>
      ))}
    </p>
  );
}

/** Dictation: hear it, write it. No tiles, no options — real recall. */
export default function WriteItem({
  item,
  locked,
  revealed,
  chosen,
  almost,
  onAnswer,
}: { item: WriteItemType } & ItemControlProps) {
  const missed = revealed && (chosen ?? "").trim().toLowerCase() !== item.answer.toLowerCase();

  return (
    <ItemFrame prompt={item.prompt} arabic={item.arabic} glossFaded={item.glossFaded}>
      <div className="flex justify-center py-2">
        <AudioButton text={item.audioText} autoPlay size={84} />
      </div>

      {item.showMeaning && item.meaning ? (
        <Card variant="soft">
          <p className="text-center font-body text-[15px] leading-snug">{item.meaning}</p>
        </Card>
      ) : null}

      {missed ? (
        <Card color="coral" variant="soft" className="space-y-1">
          <Spelled answer={item.answer} typed={chosen ?? ""} />
          {item.parts.length > 0 ? (
            <p
              className="text-center font-display text-sm font-bold"
              style={{ color: "var(--color-coral-dark)" }}
            >
              {item.parts.join(" + ")}
            </p>
          ) : null}
        </Card>
      ) : (
        <TypeAnswer
          onSubmit={onAnswer}
          disabled={locked}
          almost={almost}
          placeholder="Write the word"
        />
      )}
    </ItemFrame>
  );
}

export { WriteItem };
