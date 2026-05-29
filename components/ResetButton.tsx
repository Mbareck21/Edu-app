"use client";

// Restarts a study session to its initial state. Confirms first — matching the
// "New reading" destructive-confirm pattern — so an accidental tap can't wipe a
// kid's in-progress work.
export default function ResetButton({
  onReset,
  className = "",
  confirmMessage = "Reset this activity? Your progress will be cleared.",
}: {
  onReset: () => void;
  className?: string;
  confirmMessage?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm(confirmMessage)) {
          onReset();
        }
      }}
      className={"btn-secondary no-print " + className}
      aria-label="Reset this activity"
    >
      ↺ Reset
    </button>
  );
}
