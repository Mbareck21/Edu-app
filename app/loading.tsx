import BottomNav from "@/components/ui/BottomNav";

/**
 * Shown the moment a link is tapped, while the server builds the page. Without
 * it a tap looked dead for a second and he tapped again. The tab bar stays
 * (it hides itself on full-screen runners).
 */
export default function Loading() {
  return (
    <>
      <main className="safe-top pad-nav min-h-dvh px-4" aria-busy="true">
        <p className="sr-only" role="status">
          Loading
        </p>
        <div className="flex items-center justify-between pt-4 pb-3">
          <span className="h-7 w-28 rounded-full" style={{ background: "var(--color-sand)" }} />
          <span className="h-8 w-20 rounded-full" style={{ background: "var(--color-sand)" }} />
        </div>
        <div className="flex justify-center py-8">
          <span
            className="q-node-pulse h-14 w-14 rounded-full"
            style={{ background: "var(--color-green-soft)" }}
          />
        </div>
        <div className="space-y-3">
          <div className="h-28 rounded-card" style={{ background: "var(--color-sand)" }} />
          <div className="h-20 rounded-card" style={{ background: "var(--color-sand)" }} />
        </div>
      </main>
      <BottomNav />
    </>
  );
}
