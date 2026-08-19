import Link from "next/link";

import { buttonClass, buttonStyle } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  const opts = { variant: "primary" as const, color: "green" as const, size: "lg" as const };
  return (
    <main className="safe-top flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: "var(--color-sand)", color: "var(--color-muted)" }}
      >
        <Icon name="bolt" size={40} />
      </span>
      <h1 className="mt-6 font-display text-2xl font-bold">No internet</h1>
      <p className="mt-2 text-base" style={{ color: "var(--color-muted)" }}>
        Quest needs the internet for this page. Your last game is safe. It will
        be saved when you are back.
      </p>
      <Link href="/" className={`${buttonClass(opts)} mt-8`} style={buttonStyle(opts)}>
        Try again
      </Link>
    </main>
  );
}
