"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import Pill from "@/components/ui/Pill";

export type SeedOption = {
  kind: "science" | "theme";
  id: string;
  title: string;
  wordCount: number;
  /** True for the unit his class is on this week. */
  current: boolean;
  /** Set when a list with this name already exists. */
  existingListId: string | null;
};

export default function SchoolLists({ options }: { options: SeedOption[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function seed(option: SeedOption) {
    if (option.existingListId) {
      router.push(`/words/${option.existingListId}`);
      return;
    }
    setBusyId(option.id);
    setError(null);
    try {
      const res = await fetch("/api/lists/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: option.kind, id: option.id }),
      });
      if (!res.ok) {
        setError("Could not build that list. Try again.");
        return;
      }
      const list = (await res.json()) as { _id: string };
      router.push(`/words/${list._id}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-bold">School lists</h2>
      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
        One tap builds a list from what his class is covering. Clues are written
        for you.
      </p>
      {error ? (
        <p className="text-sm" style={{ color: "var(--color-coral-dark)" }}>
          {error}
        </p>
      ) : null}
      <ul className="space-y-2">
        {options.map((o) => (
          <li key={`${o.kind}-${o.id}`}>
            <Card padded={false}>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void seed(o)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-60"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: o.kind === "science" ? "var(--color-blue-soft)" : "var(--color-purple-soft)",
                    color: o.kind === "science" ? "var(--color-blue-dark)" : "var(--color-purple-dark)",
                  }}
                >
                  <Icon name={o.kind === "science" ? "sparkles" : "book"} size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-bold">{o.title}</span>
                  <span className="block text-sm" style={{ color: "var(--color-muted)" }}>
                    {busyId === o.id
                      ? "Writing clues…"
                      : o.existingListId
                        ? "Already added — open it"
                        : `${o.wordCount} words`}
                  </span>
                </span>
                {o.current ? (
                  <Pill color="green" size="sm">
                    Now
                  </Pill>
                ) : null}
                <span style={{ color: "var(--color-faint)" }}>
                  <Icon name="arrowRight" size={20} />
                </span>
              </button>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { SchoolLists };
