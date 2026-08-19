import Link from "next/link";

import { buttonClass, buttonStyle } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import type { ClientWordList } from "@/lib/models/WordList";
import { STEPS } from "@/lib/types";

/** The first step that has not been finished — where CONTINUE goes. */
export function nextStepId(list: ClientWordList): string {
  const open = STEPS.find((s) => !list.pathProgress[s.id]?.completedAt);
  return (open ?? STEPS[0]).id;
}

/** One word list = one unit: name, seven dots, and a way back in. */
export default function UnitCard({ list }: { list: ClientWordList }) {
  const done = STEPS.filter((s) => list.pathProgress[s.id]?.completedAt).length;
  const next = nextStepId(list);

  return (
    <Card className="space-y-3">
      <Link href={`/learn/${list._id}`} className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--color-green-soft)", color: "var(--color-green-dark)" }}
        >
          <Icon name="book" size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg font-bold">{list.name}</span>
          <span className="block font-body text-sm" style={{ color: "var(--color-muted)" }}>
            {list.words.length} word{list.words.length === 1 ? "" : "s"} · {done} of{" "}
            {STEPS.length} steps
          </span>
        </span>
      </Link>

      <div className="flex items-center gap-1.5">
        {STEPS.map((step, i) => {
          const isDone = !!list.pathProgress[step.id]?.completedAt;
          const isNext = step.id === next;
          return (
            <span
              key={step.id}
              title={step.name}
              className="h-2.5 flex-1 rounded-full"
              style={{
                background: isDone
                  ? "var(--color-green)"
                  : isNext
                    ? "var(--color-blue)"
                    : "var(--color-sand)",
                opacity: isDone || isNext || i === 0 ? 1 : 0.8,
              }}
            />
          );
        })}
      </div>

      <Link
        href={`/learn/${list._id}/${next}`}
        className={buttonClass({ color: "green", size: "lg", fullWidth: true })}
        style={buttonStyle({ color: "green" })}
      >
        Continue
      </Link>
    </Card>
  );
}

export { UnitCard };
