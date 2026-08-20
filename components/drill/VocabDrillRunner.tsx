"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import ItemRunner, { type RunnerPost } from "@/components/items/ItemRunner";
import type { LessonItem } from "@/lib/items";

export type VocabDrillRunnerProps = {
  items: LessonItem[];
  /** Activity ref, e.g. "drill:vocab:mixed". */
  sessionRef: string;
  /** Set when every item comes from one list. */
  listId?: string;
  title: string;
  subtitle?: string;
  /** Drill URL without a seed — "Again" adds a fresh one. */
  againHref: string;
  /** Spelling test: list every word right or wrong at the end. */
  report?: boolean;
  emptyNote?: string;
};

/**
 * The drill runner: the lesson runner with a live counter, a streak flame and
 * an "Again" button that re-seeds the drill.
 */
export default function VocabDrillRunner({
  items,
  sessionRef,
  listId,
  title,
  subtitle,
  againHref,
  report = false,
  emptyNote = "No words to drill yet.",
}: VocabDrillRunnerProps) {
  const router = useRouter();
  const post = useMemo<RunnerPost>(
    () => ({ ref: sessionRef, listId, deriveListId: true }),
    [sessionRef, listId]
  );

  return (
    <ItemRunner
      items={items}
      post={post}
      exitHref="/drill"
      accent="blue"
      title={title}
      subtitle={subtitle}
      primary={{ label: "Again", onClick: () => router.push(`${againHref}&seed=${Date.now()}`) }}
      secondary={{ label: "All drills", href: "/drill" }}
      progressLabel="Drill progress"
      counter
      report={report}
      emptyNote={emptyNote}
      emptyAction={{ label: "Back to drills", onClick: () => router.push("/drill") }}
    />
  );
}

export { VocabDrillRunner };
