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
  /** Spelling test: list every word right or wrong at the end. */
  report?: boolean;
  emptyNote?: string;
};

/**
 * The drill runner: the lesson runner with a live counter, a streak flame and
 * a "Next drill" button that goes on to the suggested one.
 */
export default function VocabDrillRunner({
  items,
  sessionRef,
  listId,
  title,
  subtitle,
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
      primary={{ label: "Next drill", onClick: () => router.push("/drill/next") }}
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
