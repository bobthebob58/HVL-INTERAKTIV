/**
 * reducedMotion — makes H5P's jQuery animations jump to their end when the reader asks for reduced motion.
 *
 * Why: UD-009 asks that the platform respects `prefers-reduced-motion`. ./hvl-h5p-theme.css shortens CSS animations
 *      and transitions, but H5P libraries also animate with jQuery (`.animate()`, `.fadeIn()`, `.slideDown()`),
 *      which steps inline styles on timers and ignores CSS: DragText 1.10 slides a word back across the text,
 *      Question 1.5 scrolls to its feedback, Summary 1.10 moves a correct claim into its list. jQuery's own switch,
 *      `jQuery.fx.off`, makes every such animation set its end state at once and still run its callbacks, so H5P
 *      continues exactly as after the animation.
 * Spec: UD-009
 * Invariants:
 *   - Follows the media query while the page is open: a changed system setting changes `H5P.jQuery.fx.off`.
 *   - Touches only H5P's own jQuery copy (`H5P.jQuery`) and only its `fx.off` switch; without reduced motion at
 *     start it changes nothing.
 *   - A static same-origin file with no inline code and no eval (D-070 strict policy); it runs once per document
 *     and never throws into H5P.
 * Collaborators: ./hvl-h5p-theme.css (the CSS half of UD-009), apps/server/src/h5p/h5pAssets.ts (loads it after
 *   Core's scripts into the player, H5P's iframes and the editor).
 * Tests: packages/hvl-h5p-theme/test/reducedMotion.test.ts, apps/server/test/h5p/hvlTheme.browser.int.test.ts
 */
(function hvlReducedMotion() {
  'use strict';
  if (window.hvlReducedMotionStarted || typeof window.matchMedia !== 'function') return;
  window.hvlReducedMotionStarted = true;

  var query = window.matchMedia('(prefers-reduced-motion: reduce)');
  var changed = false;

  /** Sets H5P's jQuery to the reader's preference once it exists; until the preference changes, only to "off". */
  function apply() {
    var jQuery = window.H5P && window.H5P.jQuery;
    if (!jQuery || !jQuery.fx || (!query.matches && !changed)) return;
    jQuery.fx.off = query.matches;
  }

  function onChange() {
    changed = true;
    apply();
  }

  if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange);
  // WHY: Core's jQuery is loaded before this file on every H5P page; the DOMContentLoaded run covers a document
  // that loads it later, and costs nothing when it already ran.
  document.addEventListener('DOMContentLoaded', apply);
  apply();
})();
