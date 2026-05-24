"use client";

import Link from "next/link";

export default function WorksheetFrame({
  title,
  listName,
  backHref,
  children,
}: {
  title: string;
  listName: string;
  backHref: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="app-header no-print bg-white border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-6 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link href={backHref} className="text-sm text-slate-600 hover:underline">← Back</Link>
            <span className="text-sm text-slate-500">·</span>
            <span className="text-sm font-medium">{listName} — {title}</span>
          </div>
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-6 worksheet">
        {children}
      </main>
    </>
  );
}
