/**
 * probeContentType — a minimal stand-in for H5P.MultiChoice that browser tests can click: one button that counts
 * clicks and reports the count as its state, so saving and resuming learner state can be seen.
 *
 * Why: the real content types arrive with the Hub packages (spike step 4, Q7); browser and end-to-end tests need a
 *      content type whose state changes visibly and is saved by H5P Core like any other.
 * Spec: H5P-005, LTI-003
 * Invariants: the probe implements only `attach` and `getCurrentState`; it is installed under the real machine name
 *   and version, so the player and the permission rules treat it like the real library.
 * Collaborators: ./tenTypeLibraries.ts, ./syntheticLibraries.ts.
 * Tests: apps/server/test/http/player.browser.int.test.ts, apps/server/e2e/ltiIframe.e2e.test.ts
 */
import type { SyntheticLibrary } from './syntheticLibraries.js';
import { HTTP_TEST_LIBRARIES, MULTI_CHOICE } from './tenTypeLibraries.js';

/** The probe's script: a button `.hvl-probe` inside `.hvl-probe-attached` that shows the click count. */
export const PROBE_JS = `H5P.MultiChoice = (function ($) {
  function Probe(params, contentId, extras) {
    H5P.EventDispatcher.call(this);
    var state = (extras && extras.previousState) || { clicks: 0 };
    this.getCurrentState = function () { return state; };
    this.attach = function ($container) {
      var $button = $('<button type="button" class="hvl-probe"></button>').text(String(state.clicks));
      $button.on('click', function () { state.clicks += 1; $button.text(String(state.clicks)); });
      $container.addClass('hvl-probe-attached').append($button);
    };
  }
  Probe.prototype = Object.create(H5P.EventDispatcher.prototype);
  Probe.prototype.constructor = Probe;
  return Probe;
})(H5P.jQuery);`;

/** The HTTP test libraries with H5P.MultiChoice replaced by the probe. */
export const PROBE_LIBRARIES: SyntheticLibrary[] = HTTP_TEST_LIBRARIES.map((lib) =>
  lib.machineName === MULTI_CHOICE.machineName
    ? { ...lib, files: { ...lib.files, 'js/main.js': PROBE_JS } }
    : lib,
);
