import RefreshWhenStale from "@/components/ui/RefreshWhenStale";
import { requestSeed } from "@/components/ui/time";
import { kidLocked } from "@/lib/assigned-data";

/**
 * On a page a child may only open while it is handed to him (lib/assigned.ts):
 * a back swipe after the beat or drill replayed the phone's copy of the page,
 * past the server's gate, and the same lesson could be played again for
 * points. A replayed copy asks the server again, and the gate sends him on.
 */
export default async function KidGuard() {
  return (await kidLocked()) ? <RefreshWhenStale renderedAt={requestSeed()} /> : null;
}
