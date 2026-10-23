/**
 * ltijsStorageGuard — runs before ltijs's inline login and launch scripts and keeps them working when the browser
 * blocks storage in the Canvas iframe.
 *
 * Why: where third-party storage is blocked, reading `window.localStorage` throws. ltijs 7.0.7 catches that when it
 *      stores or reads its OIDC recovery token, but its launch page then calls `localStorage.removeItem` outside any
 *      try block, so the launch form is never submitted (D-050). This guard replaces a throwing `localStorage` with a
 *      stand-in that holds nothing: `setItem` still fails, so ltijs falls back to LTI Platform Storage as intended,
 *      and `getItem`/`removeItem` no longer throw.
 * Spec: LTI-003
 * Invariants:
 *   - Stores nothing, anywhere. When storage works, it changes nothing.
 *   - Never touches the ltik (this page has none) or cookies.
 * Collaborators: ../../http/ExpressRouterHttpHandler.ts (inserts it before ltijs's HTML).
 * Tests: apps/server/test/lti/http/ExpressRouterHttpHandler.test.ts (loaded first); the cookie-less e2e launch.
 */
(function guardLtijsStorage() {
  'use strict';
  try {
    // eslint-disable-next-line no-restricted-properties -- WHY: only probes whether frame storage is blocked.
    if (window.localStorage) return;
  } catch {
    // Storage is blocked: install the stand-in below.
  }
  var standIn = {
    getItem: function getItem() {
      return null;
    },
    setItem: function setItem() {
      throw new Error('storage is blocked in this frame');
    },
    removeItem: function removeItem() {},
  };
  try {
    Object.defineProperty(window, 'localStorage', { value: standIn, configurable: true });
  } catch {
    // WHY: if the browser forbids redefining it, ltijs behaves exactly as it would without this guard.
  }
})();
