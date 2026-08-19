import mongoose from "mongoose";
import Link from "next/link";
import { notFound } from "next/navigation";

import AppShell from "@/components/ui/AppShell";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import ProgressBar from "@/components/ui/ProgressBar";
import { connectDB } from "@/lib/db";
import { countKnowledge } from "@/lib/mastery";
import { WordList, toClient, type PathProgress } from "@/lib/models/WordList";
import { STEPS } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Path geometry: 320 wide, one row per node, gently winding. */
const COLUMN = 320;
const ROW = 116;
const TOP = 62;
/** Eight stops: the seven steps with the treasure chest sitting before the last. */
const OFFSETS = [0, 62, 90, 62, 0, -62, -96, -30];
const CHEST_STOP = 6;

type NodeState = "done" | "current" | "locked";

function stateFor(index: number, progress: PathProgress): NodeState {
  const step = STEPS[index];
  if (progress[step.id]?.completedAt) return "done";
  const previous = index === 0 ? null : STEPS[index - 1];
  const open = !previous || !!progress[previous.id]?.completedAt;
  return open ? "current" : "locked";
}

export default async function PathPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await params;
  if (!mongoose.isValidObjectId(listId)) notFound();

  await connectDB();
  const doc = await WordList.findById(listId).lean();
  if (!doc) notFound();
  const list = toClient(doc);

  const progress = list.pathProgress;
  const states = STEPS.map((_, i) => stateFor(i, progress));
  // Only the first open step is "current" — everything after it stays locked.
  const currentIndex = states.indexOf("current");
  const nodes: NodeState[] = states.map((state, i) =>
    state === "current" && i !== currentIndex ? "locked" : state
  );

  const doneCount = nodes.filter((n) => n === "done").length;
  const chestOpen = !!progress.challenge?.completedAt;
  const chestNear = nodes[STEPS.length - 1] === "current";
  const counts = countKnowledge(list.words);
  const height = TOP + (OFFSETS.length - 1) * ROW + 70;

  // Dotted trail through every stop, in order.
  const points = OFFSETS.map((offset, i) => ({
    x: COLUMN / 2 + offset,
    y: TOP + i * ROW,
  }));
  const trail = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <AppShell>
      <header className="flex items-center gap-3 pt-3 pb-2">
        <Link
          href="/"
          aria-label="Back"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ color: "var(--color-muted)" }}
        >
          <Icon name="arrowLeft" size={24} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-bold">{list.name}</h1>
          <p className="font-body text-sm" style={{ color: "var(--color-muted)" }}>
            {doneCount} of {STEPS.length} done
          </p>
        </div>
      </header>

      <ProgressBar value={doneCount / STEPS.length} color="green" label="Unit progress" />

      <div className="relative mx-auto mt-4" style={{ width: COLUMN, height }}>
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
          const x = COLUMN / 2 + offset;
          const y = TOP + stop * ROW;

          if (stop === CHEST_STOP) {
            return (
              <div
                key="chest"
                className="absolute flex flex-col items-center"
                style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
              >
                <span
                  className={`flex h-16 w-16 items-center justify-center rounded-full ${chestNear && !chestOpen ? "q-shake" : ""}`}
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

          const index = stop > CHEST_STOP ? stop - 1 : stop;
          const step = STEPS[index];
          const state = nodes[index];
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
                  className="absolute -top-8 rounded-full px-3 py-1 font-display text-[11px] font-bold uppercase tracking-widest"
                  style={{ background: "var(--color-blue-dark)", color: "#fff" }}
                >
                  Start
                </span>
              ) : null}
              <span
                className={`flex items-center justify-center rounded-full ${state === "current" ? "q-node-pulse" : ""}`}
                style={{
                  width: size,
                  height: size,
                  boxShadow:
                    state === "locked"
                      ? "none"
                      : `0 5px 0 ${state === "done" ? "var(--color-green-dark)" : "var(--color-blue-dark)"}`,
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
            <div
              key={step.id}
              className="absolute flex flex-col items-center"
              style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
            >
              {state === "locked" ? (
                <span className="relative flex flex-col items-center opacity-90">{inner}</span>
              ) : (
                <Link
                  href={`/learn/${list._id}/${step.id}`}
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

      <Card className="mt-2 mb-4 flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--color-green-soft)", color: "var(--color-green-dark)" }}
        >
          <Icon name="book" size={22} />
        </span>
        <p className="font-body text-sm leading-snug">
          <strong>{counts.known + counts.mastered}</strong> of {list.words.length} words known.
          {counts.new > 0 ? ` ${counts.new} still new.` : ""}
        </p>
      </Card>
    </AppShell>
  );
}
