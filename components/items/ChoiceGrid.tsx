"use client";

import { sfx } from "@/lib/sfx";

export type ChoiceGridProps = {
  options: string[];
  answer: string;
  /** What the kid tapped. null before an answer. */
  chosen: string | null;
  /** After answering: mark the right one green. */
  revealed: boolean;
  onPick: (option: string) => void;
  disabled?: boolean;
  /** Sentences read better one per row and left aligned. */
  layout?: "words" | "sentences";
};

export default function ChoiceGrid({
  options,
  answer,
  chosen,
  revealed,
  onPick,
  disabled = false,
  layout = "words",
}: ChoiceGridProps) {
  const sentences = layout === "sentences";

  return (
    <div className={sentences ? "flex flex-col gap-2.5" : "grid grid-cols-2 gap-2.5"}>
      {options.map((option) => {
        const isAnswer = revealed && option === answer;
        const isMiss = revealed && chosen === option && option !== answer;
        const style = isAnswer
          ? {
              background: "var(--color-green-soft)",
              borderColor: "var(--color-green)",
              color: "var(--color-green-dark)",
            }
          : isMiss
            ? {
                background: "var(--color-coral-soft)",
                borderColor: "var(--color-coral)",
                color: "var(--color-coral-dark)",
              }
            : chosen === option
              ? {
                  background: "var(--color-blue-soft)",
                  borderColor: "var(--color-blue)",
                  color: "var(--color-blue-dark)",
                }
              : {
                  background: "#fff",
                  borderColor: "var(--color-line)",
                  color: "var(--color-ink)",
                };

        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => {
              sfx.tap();
              onPick(option);
            }}
            className={[
              "press-3d min-h-[56px] rounded-tile border-2 px-4 py-3 font-body font-bold disabled:cursor-default",
              sentences ? "text-left text-[15px] leading-snug" : "text-center text-lg",
            ].join(" ")}
            style={style}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export { ChoiceGrid };
