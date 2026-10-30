/**
 * nextNavigationMock — a stand-in for `next/navigation` in component tests: the search parameters and path are the
 * jsdom window's, and the router records each call and applies it to the window's address.
 *
 * Why: the studio pages keep their filters in the address (PED-003) and read it with `useSearchParams`; outside a
 *      Next.js app router those hooks throw. Backing them with `window.location` lets a test set a shared address,
 *      watch what the page writes, and see the page read it back, without a server.
 * Spec: NFR-004, PED-003
 * Invariants:
 *   - `replace` and `push` change the address synchronously and record `{ method, href, options }`.
 *   - `resetNavigation` clears the record and returns the address to `/`; ./cleanup.ts does not do it, the tests do.
 * Collaborators: apps/web/src/features/studio/catalogue/useCatalogueFilters.ts and the tests that mock
 *   `next/navigation` with `vi.mock('next/navigation', () => import('../support/nextNavigationMock'))`.
 * Tests: used by apps/web/test/features/GuideView.test.tsx, PatternCatalogue.test.tsx, PatternDetailView.test.tsx
 *   and studioPages.test.tsx.
 */

/** One router call a page made. */
export interface RouterCall {
  readonly method: 'replace' | 'push';
  readonly href: string;
  readonly options?: unknown;
}

/** Every router call since the last `resetNavigation`, in order. */
export const routerCalls: RouterCall[] = [];

const router = {
  replace: (href: string, options?: unknown) => {
    routerCalls.push({ method: 'replace', href, options });
    window.history.replaceState(null, '', href);
  },
  push: (href: string, options?: unknown) => {
    routerCalls.push({ method: 'push', href, options });
    window.history.pushState(null, '', href);
  },
};

/**
 * The window's search parameters, as `useSearchParams` gives them.
 * @returns The current query.
 */
export const useSearchParams = (): URLSearchParams => new URLSearchParams(window.location.search);

/**
 * The window's path, as `usePathname` gives it.
 * @returns The current path.
 */
export const usePathname = (): string => window.location.pathname;

/**
 * The recording router.
 * @returns `replace` and `push`.
 */
export const useRouter = () => router;

/**
 * Clears the recorded calls and sets the address.
 * @param address - The address to start from; `/` by default.
 */
export function resetNavigation(address = '/'): void {
  routerCalls.splice(0);
  window.history.replaceState(null, '', address);
}
