import RefreshWhenStale from "@/components/ui/RefreshWhenStale";
import SessionTicket from "@/components/ui/SessionTicket";
import { requestSeed } from "@/components/ui/time";
import { kidLocked } from "@/lib/assigned-data";
import { currentLearner } from "@/lib/auth";
import { mintTicket } from "@/lib/ticket";

/**
 * On a page a child may only open while it is handed to him (lib/assigned.ts):
 * a back swipe after the beat or drill replayed the phone's copy of the page,
 * past the server's gate, and the same lesson could be played again for
 * points. A replayed copy asks the server again, and the gate sends him on;
 * offline, its session carries this page's ticket, already used, and pays
 * nothing (lib/ticket.ts).
 */
export default async function KidGuard() {
  if (!(await kidLocked())) return null;
  return (
    <>
      <RefreshWhenStale renderedAt={requestSeed()} />
      <SessionTicket ticket={mintTicket(await currentLearner())} />
    </>
  );
}
