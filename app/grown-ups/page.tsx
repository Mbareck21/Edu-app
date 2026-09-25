"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { sameSitePath } from "@/lib/same-site-path";

/** The grown-ups PIN. See lib/adult.ts for what it unlocks. */
function AdultForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  return (
    <form
      className="w-full"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
          const res = await fetch("/api/adult", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin }),
          });
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            setError(res.status === 429 && typeof d.error === "string" ? d.error : "That is not the grown-ups PIN.");
            setPin("");
            return;
          }
          router.replace(sameSitePath(params.get("next") ?? "/me/lists"));
          router.refresh();
        } catch {
          setError("No internet. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        aria-label="Grown-ups PIN"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="••••"
        className="w-full rounded-card border-2 bg-white py-4 text-center font-display text-3xl tracking-[0.4em] outline-none"
        style={{
          borderColor: error ? "var(--color-coral)" : "var(--color-line)",
          color: "var(--color-ink)",
        }}
      />
      {error ? (
        <p className="mt-3 text-center text-sm font-bold" style={{ color: "var(--color-coral-dark)" }}>
          {error}
        </p>
      ) : null}
      <Button type="submit" color="blue" size="lg" fullWidth disabled={busy || pin.length < 3} className="mt-6">
        {busy ? "Checking" : "Unlock"}
      </Button>
    </form>
  );
}

export default function GrownUpsPage() {
  return (
    <main className="safe-top flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: "var(--color-blue-soft)", color: "var(--color-blue-dark)" }}
      >
        <Icon name="lock" size={40} />
      </span>
      <h1 className="mt-5 font-display text-3xl font-bold">Grown-ups only</h1>
      <p className="mt-1 mb-8 text-base" style={{ color: "var(--color-muted)" }}>
        Word lists are set up by a grown-up. Ask one to type their PIN.
      </p>
      <Suspense fallback={null}>
        <AdultForm />
      </Suspense>
      <Link href="/" className="mt-6 font-display font-bold" style={{ color: "var(--color-green-dark)" }}>
        Back to learning
      </Link>
    </main>
  );
}
