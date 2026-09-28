import { redirect } from "next/navigation";

// The old flashcards page. Its words are practised on the unit's path now; an
// old link or bookmark lands there instead of on the retired page.
export default async function OldFlashcardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/learn/${encodeURIComponent(id)}`);
}
