"use client";

import Link from "next/link";

import BottomNav from "@/components/ui/BottomNav";
import Button, { buttonClass, buttonStyle } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";

/**
 * A page that threw, most often the database timing out. Next's own page here
 * was white with no way back. unstable_retry() asks the server again; reset()
 * alone would only re-show the page that failed.
 */
export default function ErrorPage({ unstable_retry }: { error: Error; unstable_retry: () => void }) {
  return (
    <>
      <main className="safe-top pad-nav flex min-h-dvh flex-col justify-center px-4">
        <Card className="space-y-3 text-center">
          <span
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "var(--color-blue-soft)", color: "var(--color-blue-dark)" }}
          >
            <Icon name="sparkles" size={34} />
          </span>
          <h1 className="font-display text-2xl font-bold">That did not load</h1>
          <p className="font-body text-base leading-snug" style={{ color: "var(--color-muted)" }}>
            It is not your fault. Try again, or go back to Learn.
          </p>
          <Button color="green" size="lg" fullWidth onClick={() => unstable_retry()}>
            Try again
          </Button>
          <Link
            href="/"
            className={buttonClass({ variant: "secondary", color: "green", fullWidth: true })}
            style={buttonStyle({ variant: "secondary", color: "green" })}
          >
            Back to Learn
          </Link>
        </Card>
      </main>
      <BottomNav />
    </>
  );
}
