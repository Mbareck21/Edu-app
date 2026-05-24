"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteListButton({ id, name }: { id: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={busy}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
      onClick={async () => {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
        setBusy(true);
        try {
          await fetch(`/api/lists/${id}`, { method: "DELETE" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      Delete
    </button>
  );
}
