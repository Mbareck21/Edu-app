"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  return (
    <form
      className="card w-full max-w-sm space-y-4"
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
      <div>
        <h1 className="text-2xl font-semibold">Edu-App</h1>
        <p className="text-sm text-slate-600">Enter the family PIN to continue.</p>
      </div>
      <div>
        <label htmlFor="pin" className="label">PIN</label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="input mt-1 text-center tracking-widest"
          placeholder="••••"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy || pin.length < 3} className="btn-primary w-full">
        {busy ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<div className="card w-full max-w-sm">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
