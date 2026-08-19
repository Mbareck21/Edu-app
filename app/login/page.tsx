"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

function LoginForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  return (
    <form
      className="w-full"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
          const res = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin }),
          });
          if (!res.ok) {
            setError("Wrong PIN. Try again.");
            return;
          }
          router.replace(next);
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <label
        htmlFor="pin"
        className="block text-center font-display text-sm font-bold uppercase tracking-widest"
        style={{ color: "var(--color-muted)" }}
      >
        PIN
      </label>
      <input
        id="pin"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="••••"
        className="mt-2 w-full rounded-card border-2 bg-white py-4 text-center font-display text-3xl tracking-[0.4em] outline-none"
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
      <Button
        type="submit"
        color="green"
        size="lg"
        fullWidth
        disabled={busy || pin.length < 3}
        className="mt-6"
      >
        {busy ? "Checking" : "Start"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="safe-top flex min-h-dvh flex-col items-center justify-center px-6">
      <span
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: "var(--color-green-soft)", color: "var(--color-green)" }}
      >
        <Icon name="star" size={42} filled />
      </span>
      <h1 className="mt-5 font-display text-4xl font-bold">Quest</h1>
      <p className="mt-1 mb-8 text-base" style={{ color: "var(--color-muted)" }}>
        Type the PIN to play.
      </p>
      <Suspense
        fallback={
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Loading
          </p>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
