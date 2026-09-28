import { redirect } from "next/navigation";

// The old list editor. Lists are edited under Me now (behind the grown-ups
// PIN); an old link or bookmark lands there instead of on the retired page.
export default async function OldListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/me/lists/${encodeURIComponent(id)}`);
}
