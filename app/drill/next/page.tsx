import { redirect } from "next/navigation";

import { currentSuggestion } from "@/lib/assigned-data";

export const dynamic = "force-dynamic";

/**
 * "Next drill" on every finish screen: the Drill tab's suggestion, worked out
 * afresh now that the drill just played is on the record, so one tap after
 * another turns through words and math. Nothing to suggest: the Drill tab.
 */
export default async function NextDrillPage() {
  const suggestion = await currentSuggestion();
  redirect(suggestion?.href ?? "/drill");
}
