import Link from "next/link";

import BottomNav from "@/components/ui/BottomNav";
import { buttonClass, buttonStyle } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";

/** A link to a list that was deleted, or a page that never existed. */
export default function NotFound() {
  return (
    <>
      <main className="safe-top pad-nav flex min-h-dvh flex-col justify-center px-4">
        <Card className="space-y-3 text-center">
          <span
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }}
          >
            <Icon name="star" size={34} filled />
          </span>
          <h1 className="font-display text-2xl font-bold">This page is not here</h1>
          <p className="font-body text-base leading-snug" style={{ color: "var(--color-muted)" }}>
            It may have been moved or deleted. Let&rsquo;s get back to learning.
          </p>
          <Link
            href="/"
            className={buttonClass({ color: "green", fullWidth: true })}
            style={buttonStyle({ color: "green" })}
          >
            Back to Learn
          </Link>
        </Card>
      </main>
      <BottomNav />
    </>
  );
}
