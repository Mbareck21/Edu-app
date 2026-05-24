"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewListForm() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        try {
          const res = await fetch("/api/lists", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() }),
          });
          if (!res.ok) return;
          const list = await res.json();
          router.push(`/lists/${list._id}`);
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        className="input"
        placeholder="e.g. Week 1 — Animals"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={busy}
      />
      <button type="submit" disabled={busy || !name.trim()} className="btn-primary whitespace-nowrap">
        {busy ? "Creating…" : "+ New list"}
      </button>
    </form>
  );
}
