"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import { flushQueue, queueSize } from "@/lib/offline-queue";
import { clearAllProgress } from "@/lib/resume";

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
            window.location.replace("/login");
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
