"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import PetSprite from "@/components/pet/PetSprite";
import Card from "@/components/ui/Card";
import { fireConfetti } from "@/components/ui/Confetti";
import ProgressBar from "@/components/ui/ProgressBar";
import { PET_STAGES, petLines, petState, type Growth, type PetMood } from "@/lib/pet";
import { sfx } from "@/lib/sfx";

/** Per child: the stage the pet was at when this phone last showed it. */
const seenKey = (learner: string) => `quest:pet-seen:${learner}`;

function readSeen(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const noSubscribe = () => () => {};

/** A real step up since the last visit; the very first visit is not one. */
function grewSince(seen: string | null, now: string): boolean {
  const before = PET_STAGES.findIndex((s) => s.id === seen);
  return before >= 0 && PET_STAGES.findIndex((s) => s.id === now) > before;
}

/**
 * Sparky on the home tab. Tap it for the next thing it has to say. When it has
 * grown since this phone last showed it, it says so, with confetti.
 */
export default function PetCard({
  learner,
  growth,
  points,
  mood,
}: {
  learner: string;
  growth: Growth;
  points: number;
  mood: PetMood;
}) {
  const pet = petState(points, mood);
  const lines = petLines(pet, growth);
  const [line, setLine] = useState(0);
  const [bounce, setBounce] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const key = seenKey(learner);
  const seen = useSyncExternalStore(noSubscribe, () => readSeen(key), () => null);
  const grew = !dismissed && grewSince(seen, pet.stage.id);

  useEffect(() => {
    if (grew) {
      sfx.levelUp();
      void fireConfetti("big");
    }
    try {
      window.localStorage.setItem(key, pet.stage.id);
    } catch {
      // Private mode: it just celebrates again next time.
    }
  }, [grew, key, pet.stage.id]);

  const say = grew ? `I grew! I'm ${pet.stage.name} now!` : lines[line % lines.length];

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-4">
        <button
          type="button"
          aria-label="Tap Sparky"
          className="shrink-0 touch-manipulation"
          onClick={() => {
            sfx.tap();
            setDismissed(true);
            setLine((l) => l + 1);
            setBounce((b) => b + 1);
          }}
        >
          <span key={bounce} className={`block ${bounce > 0 ? "q-pop" : ""}`}>
            <span className="q-float block">
              <PetSprite stage={pet.stage.id} mood={pet.mood} size={96} />
            </span>
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-tight">{pet.stage.name}</p>
          <p
            className="relative mt-2 rounded-tile px-3 py-2 text-sm font-bold"
            style={{ background: "var(--color-green-soft)", color: "var(--color-green-dark)" }}
            aria-live="polite"
          >
            {say}
          </p>
          {pet.next ? (
            <div className="mt-3">
              <ProgressBar
                value={pet.progress}
                height={10}
                label={`Growing into ${pet.next.name}`}
              />
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
                {pet.toNext} to {pet.next.name}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
