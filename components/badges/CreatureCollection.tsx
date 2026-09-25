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
  const sets = [badges.slice(0, SET_ONE_SIZE), badges.slice(SET_ONE_SIZE)];
  // One set at a time, starting on the first one still to finish.
  const [tab, setTab] = useState(() => {
    const i = sets.findIndex((set) => set.some((b) => !b.earnedAt));
    return i === -1 ? 0 : i;
  });
  const set = sets[tab];

  return (
    <Card className="mt-3">
      <h2 className="font-display text-lg font-bold">Creature collection</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
        {found} of {badges.length} found. Tap one to meet it.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2" role="tablist">
        {sets.map((s, n) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={tab === n}
            onClick={() => {
              sfx.tap();
              setTab(n);
            }}
            className="rounded-full px-3 py-1.5 font-display text-sm font-bold"
            style={{
              background: tab === n ? "var(--color-gold-soft)" : "var(--color-sand)",
              color: tab === n ? "var(--color-gold-ink)" : "var(--color-muted)",
            }}
          >
            {n === 0 ? "Set 1" : "Set 2"} · {s.filter((b) => b.earnedAt).length}/{s.length}
          </button>
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-4 gap-2">
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
                aria-label={got ? creatureFor(badge.id).name : `Mystery creature: ${badge.name}`}
                className="press-3d flex w-full flex-col items-center rounded-card border-2 px-1 pt-1.5 pb-1.5"
                style={{
                  background: got ? "var(--color-gold-soft)" : "var(--color-sand)",
                  borderColor: got ? "var(--color-gold)" : "var(--color-line)",
                  ["--btn-shade" as string]: got ? "var(--color-gold)" : "var(--color-line)",
                }}
              >
                <span
                  className={got ? "q-float block" : "block"}
                  style={got ? { animationDelay: `${(i % 4) * 0.4}s` } : undefined}
                >
                  <Creature badgeId={badge.id} locked={!got} size={52} />
                </span>
                <span className="mt-0.5 font-display text-[11px] font-bold leading-tight">
                  {got ? creatureFor(badge.id).name.split(" ")[0] : "???"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
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
