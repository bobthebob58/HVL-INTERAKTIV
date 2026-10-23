/**
 * h5pIntegration — sets `window.H5PIntegration` from the page's JSON data block, before H5P Core loads.
 *
 * Why: the player and editor pages forbid inline scripts (`script-src` without `'unsafe-inline'`, D-070, DATA-011),
 *      so the integration object travels as inert JSON (`<script type="application/json">`) and this same-origin
 *      static file turns it into the global H5P expects. The JSON was escaped by the server (`scriptJson`), so it
 *      cannot close its element.
 * Spec: H5P-009, DATA-011, SEC-008
 * Invariants:
 *   - Reads only the element with id `h5p-integration`; a missing or malformed block leaves H5P without
 *     integration (the player shows nothing) rather than running anything.
 *   - Runs before every H5P script on the page.
 * Collaborators: ../playerPage.ts (writes the block and loads this file first), ../../../http/routes/staticRoutes.ts.
 * Tests: apps/server/test/h5p/render/playerPage.test.ts, apps/server/test/h5p/realTypes.browser.int.test.ts
 */
(function readH5pIntegration() {
  'use strict';
  var block = document.getElementById('h5p-integration');
  if (!block) return;
  window.H5PIntegration = JSON.parse(block.textContent || '{}');
})();
