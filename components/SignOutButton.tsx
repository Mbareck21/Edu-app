"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import { flushQueue, queueSize } from "@/lib/offline-queue";
import { clearAllProgress } from "@/lib/resume";

/**
 * The offline copies of the tabs carry this child's name and progress. Left
 * in place, the other child would see them the next time the phone is offline.
 * The /offline page is the same for both and stays.
 */
async function forgetCachedPages(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const names = (await caches.keys()).filter((k) => k.endsWith("-shell"));
    await Promise.all(
      names.map(async (name) => {
        const cache = await caches.open(name);
        const pages = await cache.keys();
        await Promise.all(
          pages.filter((r) => new URL(r.url).pathname !== "/offline").map((r) => cache.delete(r))
        );
      })
    );
  } catch {
    // Best effort: the next visit online refreshes them anyway.
  }
}

/**
 * Sign out, so the other child can sign in on this phone. Games still waiting
 * on the phone are sent first: sent after the switch, they would count for
 * the wrong child.
 */
export default function SignOutButton({ name }: { name: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        variant="secondary"
        color="coral"
        size="md"
        fullWidth
        disabled={busy}
        onClick={async () => {
          // One tap used to sign him out, and only a grown-up can sign back in.
          if (!window.confirm(`Sign out ${name}? You need the PIN to get back in.`)) return;
          setError(null);
          setBusy(true);
          try {
            await flushQueue();
            if (queueSize() > 0) {
              setError("Some games are not saved yet. Connect to the internet, then try again.");
              return;
            }
            await fetch("/api/auth", { method: "DELETE" });
            clearAllProgress();
            await forgetCachedPages();
            window.location.replace("/login");
          } catch {
            setError("Could not sign out. Check the internet and try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : `Sign out ${name}`}
      </Button>
      {error ? (
        <p className="mt-2 text-sm" style={{ color: "var(--color-coral-dark)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
