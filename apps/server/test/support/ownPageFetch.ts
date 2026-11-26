/**
 * ownPageFetch — the header a test adds to a request that stands for a fetch of our own pages.
 *
 * Why: the web client adds this header to every request (apps/web/src/api/apiRequest.ts), and the insight routes
 *      refuse a request without it (D-146). A test that asks a route as our pages do sends it; a test of the rule
 *      itself leaves it out.
 * Spec: DATA-007, INS-007
 * Invariants:
 *   - The name and the value are the contract's, so a test never spells them itself.
 * Collaborators: @hvl-interaktiv/api-contract (`OWN_PAGE_HEADER_NAME`, `OWN_PAGE_HEADER_VALUE`),
 *   ../../src/insight/http/insightRoutes.ts.
 * Tests: used by the tests of the insight routes (../insight/http/) and by every test that reads an insight view.
 */
import { OWN_PAGE_HEADER_NAME, OWN_PAGE_HEADER_VALUE } from '@hvl-interaktiv/api-contract';

/** The header of a fetch of our own pages, for supertest's `.set(…)` and for `fetch`'s `headers`. */
export const OWN_PAGE_FETCH: Readonly<Record<string, string>> = {
  [OWN_PAGE_HEADER_NAME]: OWN_PAGE_HEADER_VALUE,
};
