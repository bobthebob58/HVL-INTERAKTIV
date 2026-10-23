/**
 * ltikLanding — removes the ltik from the address bar of the LTI player page as soon as the page loads.
 *
 * Why: ltijs hands the launch over with `?ltik=…` (LTI-003 step 1). The token must not stay in the visible URL, the
 *      session history or a bookmark, so the page replaces its own history entry with the same URL without it
 *      (LTI-003 step 2). The player's own requests already carry the token in their URLs (D-058).
 * Spec: LTI-003
 * Invariants:
 *   - Uses `history.replaceState` only: no reload, no new history entry, no request.
 *   - Never stores the ltik anywhere (ESLint forbids storage APIs and cookies in this folder).
 *   - Every other query parameter and the fragment are kept.
 * Collaborators: ../../play/ltiPlayRoutes.ts (loads it first on the player page).
 * Tests: apps/server/test/lti/pages/ltikLanding.test.ts
 */
(function removeLtikFromAddressBar() {
  'use strict';
  var url = new URL(window.location.href);
  if (!url.searchParams.has('ltik')) return;
  url.searchParams.delete('ltik');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
})();
