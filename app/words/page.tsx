import Link from "next/link";

import BottomNav from "@/components/ui/BottomNav";
import StuckBoard from "@/components/stuck/StuckBoard";
import { SpellChain } from "@/lib/models/SpellChain";
import { connectDB } from "@/lib/db";
import { newChain, type ChainState } from "@/lib/spell-chain";
import { getPool } from "@/lib/word-source";

export const dynamic = "force-dynamic";
export const metadata = { title: "Words" };

/**
 * The Words tab: the words he is stuck on, and the drill that fixes them.
 *
 * This used to be the parent's list admin — create a list, edit words, print a
 * crossword. That moved to Me, where the rest of the grown-up controls live.
 * The tab a nine-year-old taps should hand him something to do.
 */
export default async function WordsPage() {
  const pool = await getPool();
  await connectDB();

  const words = pool.words.map((w) => w.word);
  const rows = words.length > 0 ? await SpellChain.find({ word: { $in: words } }).lean() : [];

  const chains: Record<string, ChainState> = {};
  for (const word of words) {
    const row = rows.find((r) => r.word === word);
    chains[word] = row
      ? {
          word,
          current: Number(row.current) || 0,
          best: Number(row.best) || 0,
          reps: Number(row.reps) || 0,
          attempts: Number(row.attempts) || 0,
          graduatedAt: row.graduatedAt ? new Date(row.graduatedAt).toISOString() : null,
        }
      : newChain(word);
  }

  return (
    <>
      <main className="safe-top px-4 pb-28 pt-6">
        <h1 className="font-display text-3xl font-bold">Words to fix</h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-muted)" }}>
          Write each one ten times without a mistake.
        </p>

        <StuckBoard list={pool} chains={chains} />

        <p className="mt-10 text-center text-sm" style={{ color: "var(--color-muted)" }}>
          <Link href="/me/lists" className="font-bold underline underline-offset-4">
            Manage word lists
          </Link>
        </p>
      </main>
      <BottomNav />
    </>
  );
}
