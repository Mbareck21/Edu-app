/**
 * The ticket of the page on screen (lib/ticket.ts), for postSession to send as
 * the session's id. Set by <SessionTicket>, which a locked page carries, and
 * cleared when that page goes. A page replayed from the phone mounts the same
 * ticket again, which the server has already used: the replay pays nothing.
 *
 * Client-side and pure apart from this one variable.
 */

let current: string | null = null;

export function setPageTicket(ticket: string | null): void {
  current = ticket;
}

/** The page's ticket, once: a second session on one page gets an id of its own. */
export function takePageTicket(): string | undefined {
  const ticket = current ?? undefined;
  current = null;
  return ticket;
}
