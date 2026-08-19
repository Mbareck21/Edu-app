"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import InstallButton from "@/components/ui/InstallButton";
import { useSfx } from "@/lib/sfx";
import { MAX_DAILY_GOAL, MIN_DAILY_GOAL } from "@/lib/rewards";

type Save = { state: "idle" } | { state: "saving" } | { state: "saved" } | { state: "error" };

export type ProfileSettingsProps = { name: string; dailyGoal: number };

const GOALS = Array.from(
  { length: MAX_DAILY_GOAL - MIN_DAILY_GOAL + 1 },
  (_, i) => MIN_DAILY_GOAL + i
);

export default function ProfileSettings({ name, dailyGoal }: ProfileSettingsProps) {
  const router = useRouter();
  const [draftName, setDraftName] = useState(name);
  const [goal, setGoal] = useState(dailyGoal);
  const [save, setSave] = useState<Save>({ state: "idle" });
  const { muted, setMuted, sfx } = useSfx();

  async function patch(body: { name?: string; dailyGoal?: number }) {
    setSave({ state: "saving" });
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setSave({ state: "error" });
        return;
      }
      setSave({ state: "saved" });
      router.refresh();
    } catch {
      setSave({ state: "error" });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label
          htmlFor="kid-name"
          className="font-display text-sm font-bold uppercase tracking-wide"
          style={{ color: "var(--color-muted)" }}
        >
          Name
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="kid-name"
            value={draftName}
            maxLength={24}
            onChange={(e) => setDraftName(e.target.value)}
            className="min-w-0 flex-1 rounded-tile border-2 bg-white px-3 py-3 font-display text-lg outline-none"
            style={{ borderColor: "var(--color-line)" }}
          />
          <Button
            color="green"
            size="md"
            disabled={
              save.state === "saving" ||
              draftName.trim().length === 0 ||
              draftName.trim() === name
            }
            onClick={() => patch({ name: draftName.trim() })}
          >
            Save
          </Button>
        </div>
      </div>

      <div>
        <p
          className="font-display text-sm font-bold uppercase tracking-wide"
          style={{ color: "var(--color-muted)" }}
        >
          Games a day
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {GOALS.map((n) => {
            const on = n === goal;
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  sfx.tap();
                  setGoal(n);
                  void patch({ dailyGoal: n });
                }}
                className="btn-3d h-12 w-12 rounded-full border-2 font-display text-lg font-bold"
                style={{
                  background: on ? "var(--color-green)" : "#fff",
                  color: on ? "#fff" : "var(--color-ink)",
                  borderColor: on ? "var(--color-green)" : "var(--color-line)",
                  ["--btn-shade" as string]: on
                    ? "var(--color-green-dark)"
                    : "var(--color-line)",
                }}
                aria-pressed={on}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-base font-bold">Sound</p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            {muted ? "Off" : "On"}
          </p>
        </div>
        <Button
          variant="secondary"
          color={muted ? "coral" : "green"}
          size="md"
          onClick={() => {
            setMuted(!muted);
            if (muted) sfx.correct();
          }}
        >
          <Icon name="volume" size={20} />
          {muted ? "Turn on" : "Turn off"}
        </Button>
      </div>

      <InstallButton />

      {save.state === "error" ? (
        <p className="text-sm font-bold" style={{ color: "var(--color-coral-dark)" }}>
          Did not save. Try again.
        </p>
      ) : null}
      {save.state === "saved" ? (
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Saved.
        </p>
      ) : null}
    </div>
  );
}

export { ProfileSettings };
