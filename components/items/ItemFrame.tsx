import type { ReactNode } from "react";

import ArabicChip from "@/components/items/ArabicChip";

export type ItemFrameProps = {
  prompt: string;
  arabic?: string;
  glossFaded?: boolean;
  children: ReactNode;
};

/** The shell every item shares: instruction line, the AR chip, then the work. */
export default function ItemFrame({
  prompt,
  arabic = "",
  glossFaded = false,
  children,
}: ItemFrameProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-xl font-bold leading-snug">{prompt}</h2>
        <ArabicChip arabic={arabic} faded={glossFaded} className="mt-0.5 shrink-0" />
      </div>
      {children}
    </div>
  );
}

/** A sentence with the target word picked out in bold. */
export function Marked({ text, word }: { text: string; word: string }) {
  if (!word.trim()) return <>{text}</>;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(\\b${escaped}\\b)`, "i"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === word.toLowerCase() ? (
          <strong key={i} style={{ color: "var(--color-blue-dark)" }}>
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export { ItemFrame };
