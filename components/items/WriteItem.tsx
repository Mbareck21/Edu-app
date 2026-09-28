"use client";

import AudioButton from "@/components/items/AudioButton";
import ItemFrame from "@/components/items/ItemFrame";
import TypeAnswer from "@/components/items/TypeAnswer";
import Card from "@/components/ui/Card";
import { spellingKey, type WriteItem as WriteItemType } from "@/lib/items";
import { hintFor } from "@/lib/number-words";
import { missedLetters } from "@/lib/spelling-marks";
import type { ItemControlProps } from "@/components/items/props";

/** Letters he missed come back red; the rest stay black. */
function Spelled({ answer, typed }: { answer: string; typed: string }) {
  const missed = missedLetters(answer, typed);
  return (
    // Sized to the screen so a 15-letter word fits the card; break-words only
    // splits a word that still would not.
    <p className="text-center font-display text-[clamp(1.25rem,7vw,1.875rem)] font-bold tracking-[0.12em] break-words lowercase">
      {answer.split("").map((letter, i) => (
        <span
          key={i}
          style={{
            color: missed[i] ? "var(--color-coral-dark)" : "var(--color-ink)",
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
  // Judge it the way the grader did. A raw compare called "rocklayer" a miss
  // for "rock layer" and painted the word red under a green "Nice work!".
  const missed = revealed && spellingKey(chosen ?? "") !== spellingKey(item.answer);
  // Number words are where he actually loses marks — "fefte" for fifty, "ghate"
  // for eighty. Naming the rule beats a second red word.
  const hint = missed ? hintFor(chosen ?? "", item.answer) : null;

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
          {hint ? (
            <p className="text-center font-body text-[15px] leading-snug">{hint}</p>
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
