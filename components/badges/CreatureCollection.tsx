"use client";

import { useEffect, useState } from "react";

import Creature from "@/components/badges/Creature";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { SET_ONE_SIZE, creatureFor } from "@/lib/creatures";
import { sfx } from "@/lib/sfx";

export type CollectionBadge = {
  id: string;
  name: string;
  blurb: string;
  /** ISO date it was won; missing = still to find. */
  earnedAt?: string;
};

/**
 * The badges as creatures to collect. Found ones come out in colour and bob;
 * the rest are mystery silhouettes. Tap any one to open it big.
 */
export default function CreatureCollection({ badges }: { badges: CollectionBadge[] }) {
  const [open, setOpen] = useState<CollectionBadge | null>(null);
  const found = badges.filter((b) => b.earnedAt).length;

  return (
    <Card className="mt-3">
      <h2 className="font-display text-lg font-bold">Creature collection</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
        {found} of {badges.length} found. Tap one to meet it.
      </p>
      {[badges.slice(0, SET_ONE_SIZE), badges.slice(SET_ONE_SIZE)].map((set, n) => (
        <section key={n}>
          <h3 className="mt-4 font-display text-sm font-bold">
            {n === 0 ? "Set 1" : "Set 2: bigger goals"}
            <span className="ml-2 font-normal" style={{ color: "var(--color-muted)" }}>
              {set.filter((b) => b.earnedAt).length} of {set.length}
            </span>
          </h3>
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {set.map((badge, i) => {
              const got = Boolean(badge.earnedAt);
              return (
                <li key={badge.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (got) sfx.chest();
                      else sfx.tap();
                      setOpen(badge);
                    }}
                    className="press-3d flex w-full flex-col items-center rounded-card border-2 px-1 pt-2 pb-2"
                    style={{
                      background: got ? "var(--color-gold-soft)" : "var(--color-sand)",
                      borderColor: got ? "var(--color-gold)" : "var(--color-line)",
                      ["--btn-shade" as string]: got ? "var(--color-gold)" : "var(--color-line)",
                    }}
                  >
                    <span
                      className={got ? "q-float block" : "block"}
                      style={got ? { animationDelay: `${(i % 3) * 0.4}s` } : undefined}
                    >
                      <Creature badgeId={badge.id} locked={!got} size={72} />
                    </span>
                    <span className="mt-1 font-display text-xs font-bold leading-tight">
                      {got ? creatureFor(badge.id).name.split(" ")[0] : "???"}
                    </span>
                    <span className="text-[11px] leading-tight" style={{ color: "var(--color-muted)" }}>
                      {badge.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {open ? <CreatureSheet badge={open} onClose={() => setOpen(null)} /> : null}
    </Card>
  );
}

function CreatureSheet({ badge, onClose }: { badge: CollectionBadge; onClose: () => void }) {
  const got = Boolean(badge.earnedAt);
  const info = creatureFor(badge.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgb(31 42 55 / 0.45)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={got ? info.name : "A mystery creature"}
        className="q-sheet-up safe-bottom w-full max-w-app rounded-t-[28px] bg-white px-6 pt-6 pb-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={got ? "q-bounce-in mx-auto w-fit" : "mx-auto w-fit"}>
          <Creature badgeId={badge.id} locked={!got} size={160} />
        </div>
        <h3 className="mt-2 font-display text-2xl font-bold">{got ? info.name : "A mystery creature"}</h3>
        <p
          className="mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{
            background: got ? "var(--color-gold-soft)" : "var(--color-sand)",
            color: got ? "var(--color-gold-ink)" : "var(--color-muted)",
          }}
        >
          {badge.name}
        </p>
        <p className="mt-3 text-base">
          {got ? badge.blurb : `To find me: ${info.hint}`}
        </p>
        {got && badge.earnedAt ? (
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            Found on {new Date(badge.earnedAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          </p>
        ) : null}
        <Button className="mt-5" color={got ? "gold" : "blue"} size="lg" fullWidth onClick={onClose}>
          {got ? "Yay!" : "I'll find it!"}
        </Button>
      </div>
    </div>
  );
}
