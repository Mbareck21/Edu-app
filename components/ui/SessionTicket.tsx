"use client";

import { useEffect } from "react";

import { setPageTicket } from "@/lib/page-ticket";

/** Hands this page's ticket to postSession while the page is on screen. See lib/page-ticket.ts. */
export default function SessionTicket({ ticket }: { ticket: string }) {
  useEffect(() => {
    setPageTicket(ticket);
    return () => setPageTicket(null);
  }, [ticket]);
  return null;
}
