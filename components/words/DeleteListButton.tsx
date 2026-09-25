"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Icon from "@/components/ui/Icon";

/** `leaveTo`: where to go after deleting, when the page showed the list itself. */
export default function DeleteListButton({
  id,
  name,
  leaveTo,
}: {
  id: string;
  name: string;
  leaveTo?: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Delete ${name}`}
      className="press-3d inline-flex h-11 items-center gap-1.5 rounded-full border-2 px-4 font-display text-sm font-bold disabled:opacity-50"
      style={{
        borderColor: "var(--color-line)",
        background: "#fff",
        color: "var(--color-coral-dark)",
        ["--btn-shade" as string]: "var(--color-line)",
      }}
      onClick={async () => {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
        setBusy(true);
        try {
          const res = await fetch(`/api/lists/${id}`, { method: "DELETE" });
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
            alert(typeof data?.error === "string" ? data.error : "Could not delete the list.");
          } else if (leaveTo) {
            router.replace(leaveTo);
          }
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon name="trash" size={18} />
      Delete
    </button>
  );
}

export { DeleteListButton };
