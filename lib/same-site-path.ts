// Pure, client-side. Shared by the sign-in and grown-ups PIN pages.

/**
 * Where to go after the PIN: a page on this site, or Home. `next` is whatever
 * the address bar says, and `/login?next=https://…` would hand him to another
 * site right after he typed the PIN — one free to show its own "Wrong PIN".
 * Resolving it is the check: a string test misses `/\t/evil.example`, which the
 * URL parser turns into `//evil.example`.
 */
export function sameSitePath(next: string | null): string {
  if (!next) return "/";
  try {
    const url = new URL(next, window.location.origin);
    if (url.origin === window.location.origin) return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // Not a URL at all.
  }
  return "/";
}
