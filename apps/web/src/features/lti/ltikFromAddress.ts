/**
 * ltikFromAddress — takes the ltik out of the Canvas page's address bar, once, and keeps it in memory.
 *
 * Why: ltijs sends a launch to `/app/play?ltik=…` (D-069). The ltik grants the launch's access for hours, so it must
 *      leave the address bar at once, where history, bookmarks, screenshots and Referer headers could leak it, and
 *      live only in page memory (LTI-003, D-048). React may ask for it more than once; the address bar is read once.
 * Spec: LTI-003
 * Invariants:
 *   - The first call reads `ltik` and removes it with `history.replaceState`; later calls return the same value.
 *   - Next.js's router also keeps the address it read at start-up and writes it back on every router update (a
 *     refresh, a hot reload). Once its history hooks are installed, a second `replaceState` without Next.js's own
 *     marker makes it adopt the clean address, so the ltik never comes back.
 *   - Never stored in localStorage, sessionStorage or a cookie; never logged.
 *   - Returns null when the address had no ltik.
 * Collaborators: ./LtiPlayView.tsx.
 * Tests: apps/web/test/features/LtiPlayView.test.tsx
 */

let taken: { readonly value: string | null } | undefined;
let routerClean: ReturnType<typeof setTimeout> | undefined;

/**
 * The key Next.js puts in `history.state` for entries its router wrote; its `replaceState` hook then skips its own
 * router update.
 */
const NEXT_ROUTER_MARK = '__NA';

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
 * Hands the clean address to Next.js's router: `replaceState` with the current state minus Next.js's marker.
 * UPSTREAM: https://github.com/vercel/next.js/blob/v16.4.2/packages/next/src/client/components/app-router.tsx
 * Next.js 16 sets its `canonicalUrl` from `location` before this page's script runs, and `HistoryUpdater` writes that
 * URL back with every router state change. Its patched `replaceState` dispatches a `restore` with the given URL (no
 * request) when the state has no `__NA`, which replaces the `canonicalUrl` that still held the ltik.
 */
function cleanRouterAddress(): void {
  const { [NEXT_ROUTER_MARK]: _mark, ...state } = (window.history.state ?? {}) as Record<string, unknown>;
  window.history.replaceState(state, '', withoutLtik(window.location.href));
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
    // SECURITY: LTI-003: React calls this from a child effect, before Next.js installs its history hooks in its root
    // effect; the next task runs after both, so the router forgets the address with the ltik too.
    routerClean = setTimeout(cleanRouterAddress, 0);
  }
  return taken.value;
}

/** Forgets the taken ltik; for tests only, which load several pages in one window. */
export function resetTakenLtikForTests(): void {
  clearTimeout(routerClean);
  taken = undefined;
}
