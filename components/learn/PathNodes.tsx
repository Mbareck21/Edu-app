import Link from "next/link";

import Icon from "@/components/ui/Icon";
import type { PathProgress } from "@/lib/models/WordList";
import { STEPS } from "@/lib/types";

/** Path geometry: a 320-wide column, one row per stop, gently winding. */
const COLUMN = 320;
const ROW = 116;
const TOP = 62;
/** Eight stops: the seven steps, with the treasure chest before the last one. */
const OFFSETS = [0, 62, 90, 62, 0, -62, -96, -30];
const CHEST_STOP = 6;

export type NodeState = "done" | "current" | "locked";

/** Step N is open when step N-1 was finished. Only the first open one is current. */
export function nodeStates(progress: PathProgress): NodeState[] {
  const raw: NodeState[] = STEPS.map((step, i) => {
    if (progress[step.id]?.completedAt) return "done";
    const previous = i === 0 ? null : STEPS[i - 1];
    return !previous || progress[previous.id]?.completedAt ? "current" : "locked";
  });
  const first = raw.indexOf("current");
  return raw.map((state, i) => (state === "current" && i !== first ? "locked" : state));
}

/** The winding node path: done, current and locked stops plus the chest. */
export default function PathNodes({
  listId,
  progress,
}: {
  listId: string;
  progress: PathProgress;
}) {
  const nodes = nodeStates(progress);
  const chestOpen = !!progress.challenge?.completedAt;
  const chestNear = nodes[STEPS.length - 1] === "current";
  const height = TOP + (OFFSETS.length - 1) * ROW + 70;
  const trail = OFFSETS.map(
    (offset, i) => `${i === 0 ? "M" : "L"} ${COLUMN / 2 + offset} ${TOP + i * ROW}`
  ).join(" ");

  return (
    <div className="relative mx-auto" style={{ width: COLUMN, height }}>
      <svg
        className="absolute inset-0"
        width={COLUMN}
        height={height}
        viewBox={`0 0 ${COLUMN} ${height}`}
        aria-hidden="true"
      >
        <path
          d={trail}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray="2 16"
        />
      </svg>

      {OFFSETS.map((offset, stop) => {
        const place = {
          left: COLUMN / 2 + offset,
          top: TOP + stop * ROW,
          transform: "translate(-50%, -50%)",
        };

        if (stop === CHEST_STOP) {
          return (
            <div key="chest" className="absolute flex flex-col items-center" style={place}>
              <span
                className={`flex h-16 w-16 items-center justify-center rounded-full ${
                  chestNear && !chestOpen ? "q-shake" : ""
                }`}
                style={{
                  background: chestOpen ? "var(--color-gold)" : "var(--color-sand)",
                  color: chestOpen ? "var(--color-gold-ink)" : "var(--color-faint)",
                }}
              >
                <Icon name="chest" size={32} />
              </span>
              <span
                className="mt-1 font-display text-[11px] font-bold uppercase tracking-wide"
                style={{ color: "var(--color-faint)" }}
              >
                {chestOpen ? "Won" : "Treasure"}
              </span>
            </div>
          );
        }

        const step = STEPS[stop > CHEST_STOP ? stop - 1 : stop];
        const state = nodes[stop > CHEST_STOP ? stop - 1 : stop];
        const size = state === "current" ? 92 : 68;
        const look =
          state === "done"
            ? { background: "var(--color-green)", color: "#fff" }
            : state === "current"
              ? { background: "var(--color-blue)", color: "#fff" }
              : { background: "var(--color-sand)", color: "var(--color-faint)" };

        const inner = (
          <>
            {state === "current" ? (
              <span
                className="absolute -top-7 rounded-full px-3 py-1 font-display text-[11px] font-bold uppercase tracking-widest"
                style={{ background: "var(--color-blue-dark)", color: "#fff" }}
              >
                Start
              </span>
            ) : null}
            <span
              className={`flex items-center justify-center rounded-full ${
                state === "current" ? "q-node-pulse" : ""
              }`}
              style={{
                width: size,
                height: size,
                boxShadow:
                  state === "locked"
                    ? "none"
                    : `0 5px 0 ${
                        state === "done" ? "var(--color-green-dark)" : "var(--color-blue-dark)"
                      }`,
                ...look,
              }}
            >
              <Icon
                name={state === "done" ? "check" : state === "locked" ? "lock" : step.icon}
                size={state === "current" ? 38 : 28}
                strokeWidth={state === "done" ? 3 : 2.4}
              />
            </span>
            <span
              className="mt-1 font-display text-[11px] font-bold uppercase tracking-wide"
              style={{ color: state === "locked" ? "var(--color-faint)" : "var(--color-ink)" }}
            >
              {step.name}
            </span>
          </>
        );

        return (
          <div key={step.id} className="absolute flex flex-col items-center" style={place}>
            {state === "locked" ? (
              <span className="relative flex flex-col items-center">{inner}</span>
            ) : (
              <Link
                href={`/learn/${listId}/${step.id}`}
                className="press-3d relative flex flex-col items-center"
                aria-label={`${step.name}: ${step.blurb}`}
              >
                {inner}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { PathNodes };
