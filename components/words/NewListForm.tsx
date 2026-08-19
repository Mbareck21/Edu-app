"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function NewListForm() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <Card>
      <h2 className="font-display text-lg font-bold">New list</h2>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/lists", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: name.trim() }),
            });
            if (!res.ok) {
              setError("Could not create that list.");
              return;
            }
            const list = (await res.json()) as { _id: string };
            router.push(`/words/${list._id}`);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          className="min-h-[52px] flex-1 rounded-tile border-2 px-3 text-base"
          style={{ borderColor: "var(--color-line)", background: "#fff" }}
          placeholder="Week 1 — Animals"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        <Button type="submit" size="md" color="green" disabled={busy || !name.trim()}>
          {busy ? "Adding" : "Add"}
        </Button>
      </form>
      {error ? (
        <p className="mt-2 text-sm" style={{ color: "var(--color-coral-dark)" }}>
          {error}
        </p>
      ) : null}
    </Card>
  );
}

export { NewListForm };
