"use client";

import { useState } from "react";

import Icon from "@/components/ui/Icon";

/** Lock the grown-ups pages now, before handing the phone back. */
export default function LockButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/adult", { method: "DELETE" }).catch(() => null);
        window.location.replace("/");
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border-2 px-3 py-1.5 font-display text-sm font-bold"
      style={{ borderColor: "var(--color-line)", color: "var(--color-ink)", background: "#fff" }}
    >
      <Icon name="lock" size={16} />
      {busy ? "Locking" : "Lock now"}
    </button>
  );
}
