/**
 * h5pStorageGuard — runs first on the LTI player page and keeps H5P Core working when the browser blocks storage
 * in the Canvas iframe.
 *
 * Why: where third-party storage is blocked, reading `window.localStorage` throws. H5P Core 1.28 reads it without a
 *      try block (the xAPI actor UUID in h5p-x-api-event.js, the copy-and-paste clipboard in h5p.js and the xAPI
 *      request queue), so `H5P.init` stops half-way and learner state is never saved (found by the cookie-less
 *      e2e launch; D-050). This guard gives H5P a stand-in that keeps values in page memory only.
 * Spec: LTI-003, H5P-005
 * Invariants:
 *   - When storage works, it changes nothing.
 *   - The stand-in lives in this page's memory and is gone when the page unloads; nothing reaches disk or cookies.
 *   - It is never handed the ltik: nothing on the player page writes the ltik to storage.
 * Collaborators: ../../play/ltiPlayRoutes.ts (loads it before H5P Core), ./ltijsStorageGuard.js (the launch pages'
 *   guard, which must keep `setItem` failing for ltijs; this one must not).
 * Tests: apps/server/e2e/ltiIframe.e2e.test.ts
 */
(function guardH5pStorage() {
  'use strict';
  try {
    // eslint-disable-next-line no-restricted-properties -- WHY: only probes whether frame storage is blocked.
    if (window.localStorage) return;
  } catch {
    // Storage is blocked: install the stand-in below.
  }
  var values = new Map();
  var standIn = {
    get length() {
      return values.size;
    },
    key: function key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    getItem: function getItem(name) {
      return values.has(String(name)) ? values.get(String(name)) : null;
    },
    setItem: function setItem(name, value) {
      values.set(String(name), String(value));
    },
    removeItem: function removeItem(name) {
      values.delete(String(name));
    },
    clear: function clear() {
      values.clear();
    },
  };
  try {
    Object.defineProperty(window, 'localStorage', { value: standIn, configurable: true });
  } catch {
    // WHY: if the browser forbids redefining it, H5P behaves exactly as it would without this guard.
  }
})();
