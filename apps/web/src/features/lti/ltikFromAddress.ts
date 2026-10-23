/**
 * ltikFromAddress — takes the ltik out of the Canvas page's address bar, once, and keeps it in memory.
 *
 * Why: ltijs sends a launch to `/app/play?ltik=…` (D-069). The ltik grants the launch's access for hours, so it must
 *      leave the address bar at once, where history, bookmarks, screenshots and Referer headers could leak it, and
 *      live only in page memory (LTI-003, D-048). React may ask for it more than once; the address bar is read once.
 * Spec: LTI-003
 * Invariants:
 *   - The first call reads `ltik` and removes it with `history.replaceState`; later calls return the same value.
 *   - Never stored in localStorage, sessionStorage or a cookie; never logged.
 *   - Returns null when the address had no ltik.
 * Collaborators: ./LtiPlayView.tsx.
 * Tests: apps/web/test/features/LtiPlayView.test.tsx
 */

let taken: { readonly value: string | null } | undefined;

/**
 * The address without its `ltik` parameter.
 * @param href - The page's full address.
 * @returns Path, query and fragment without any `ltik`.
 */
export function withoutLtik(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('ltik');
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * The page's ltik, taken from the address bar on the first call.
 * @returns The ltik, or null when the page was opened without one.
 */
export function takeLtik(): string | null {
  if (taken) return taken.value;
  const value = new URL(window.location.href).searchParams.get('ltik');
  taken = { value: value === null || value === '' ? null : value };
  if (value !== null) {
    // SECURITY: LTI-003: remove the bearer token from the address bar, history and any later Referer at once.
    window.history.replaceState(window.history.state, '', withoutLtik(window.location.href));
  }
  return taken.value;
}

/** Forgets the taken ltik; for tests only, which load several pages in one window. */
export function resetTakenLtikForTests(): void {
  taken = undefined;
}
