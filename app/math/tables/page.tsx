import AppShell from "@/components/ui/AppShell";
import Icon from "@/components/ui/Icon";
import TablesBoard from "@/components/tables/TablesBoard";
import { requestSeed } from "@/components/ui/time";
import { connectDB } from "@/lib/db";
import { TimesFact } from "@/lib/models/TimesFact";
import { factFromRow, type FactState } from "@/lib/tables";

export const dynamic = "force-dynamic";
export const metadata = { title: "Times tables" };

/** Tables 2 to 9 as a grid to fill in. See lib/tables.ts. */
export default async function TablesPage() {
  await connectDB();
  const rows = await TimesFact.find().lean();
  const facts: Record<string, FactState> = {};
  for (const r of rows) facts[r.key] = factFromRow(r.key, r);

  return (
    <AppShell>
      <div className="flex items-center gap-2 pt-4 pb-1">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "var(--color-purple-soft)", color: "var(--color-purple)" }}
        >
          <Icon name="math" size={22} />
        </span>
        <h1 className="font-display text-2xl font-bold">Times tables</h1>
      </div>
      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
        Two to nine. Light up the grid.
      </p>
      <TablesBoard facts={facts} seed={requestSeed()} />
    </AppShell>
  );
}
