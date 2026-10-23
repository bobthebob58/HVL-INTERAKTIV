/**
 * feedbackPrefixes — adds a visually hidden "Riktig:" / "Feil:" (or the en label) to every correct or incorrect
 * answer inside an H5P document, and keeps it in step while H5P changes the page.
 *
 * Why: UD-003 asks that screen readers announce the state of an answer as text, not by colour. The theme shows
 *      "✓ Riktig:" with CSS `::before`, but generated content is not announced reliably, so the visible prefix has
 *      empty alternative text and this script adds the label as a real, visually hidden text node. It reads the
 *      target selectors and the label from ../dist/hvl-feedback-prefixes.css (custom properties), so the language
 *      follows `:lang()` exactly as the visible prefix does (UD-010) and no list is written twice.
 * Spec: UD-003, UD-010
 * Invariants:
 *   - Idempotent: a target has at most one hidden prefix, as its first child; running again changes nothing.
 *   - A prefix disappears when its element is no longer in that state (retry) and changes with the language.
 *   - A static same-origin file with no inline code and no eval (D-070 strict policy); it runs once per document.
 *   - Never throws into H5P: an unknown selector or a missing stylesheet leaves the page as it is.
 * Collaborators: ../dist/hvl-feedback-prefixes.css (targets and labels), ./hvl-h5p-feedback.css (`.hvl-feedback-sr`),
 *   apps/server/src/h5p/h5pAssets.ts (loads it into the player, H5P's iframes and the editor).
 * Tests: packages/hvl-h5p-theme/test/feedbackPrefixes.test.ts, apps/server/test/h5p/hvlTheme.browser.int.test.ts
 */
(function hvlFeedbackPrefixes() {
  'use strict';
  if (window.hvlFeedbackPrefixesStarted) return;
  window.hvlFeedbackPrefixesStarted = true;

  var HIDDEN_CLASS = 'hvl-feedback-sr';
  var STATES = ['correct', 'incorrect'];

  /** The text of a CSS string value such as `'Riktig:'`, or '' for anything else. */
  function cssString(value) {
    var text = (value || '').trim();
    var quote = text.charAt(0);
    if (text.length < 2 || (quote !== "'" && quote !== '"') || text.charAt(text.length - 1) !== quote)
      return '';
    return text.slice(1, -1);
  }

  function property(element, name) {
    return cssString(window.getComputedStyle(element).getPropertyValue(name));
  }

  /** The label in the element's language; the document's when the element's language has no rule. */
  function labelFor(element, state) {
    var name = '--hvl-feedback-' + state + '-label';
    return property(element, name) || property(document.documentElement, name);
  }

  function selectorFor(state) {
    return property(document.documentElement, '--hvl-feedback-' + state + '-targets');
  }

  function matches(element, selector) {
    try {
      return Boolean(selector) && element.matches(selector);
    } catch {
      return false;
    }
  }

  function targetsOf(selector) {
    try {
      return selector ? document.querySelectorAll(selector) : [];
    } catch {
      return [];
    }
  }

  function isPrefix(node) {
    return Boolean(node) && node.nodeType === 1 && node.classList.contains(HIDDEN_CLASS);
  }

  /** Removes prefixes whose element left its state or that are no longer its first child. */
  function removeStale(selectors) {
    var prefixes = document.querySelectorAll('.' + HIDDEN_CLASS);
    for (var i = 0; i < prefixes.length; i += 1) {
      var prefix = prefixes[i];
      var parent = prefix.parentElement;
      var state = prefix.getAttribute('data-hvl-feedback');
      if (!parent || parent.firstChild !== prefix || !matches(parent, selectors[state])) prefix.remove();
    }
  }

  function ensurePrefix(target, state) {
    var text = labelFor(target, state);
    if (!text) return;
    var first = target.firstChild;
    if (isPrefix(first)) {
      if (first.getAttribute('data-hvl-feedback') === state && first.textContent === text + ' ') return;
      first.remove();
    }
    var prefix = document.createElement('span');
    prefix.className = HIDDEN_CLASS;
    prefix.setAttribute('data-hvl-feedback', state);
    prefix.textContent = text + ' ';
    target.insertBefore(prefix, target.firstChild);
  }

  function update() {
    var selectors = { correct: selectorFor('correct'), incorrect: selectorFor('incorrect') };
    removeStale(selectors);
    STATES.forEach(function addPrefixes(state) {
      var targets = targetsOf(selectors[state]);
      for (var i = 0; i < targets.length; i += 1) ensurePrefix(targets[i], state);
    });
  }

  // WHY: H5P builds and re-renders its DOM long after this file runs (on check, retry and navigation), so changes
  // are watched for; the update after the script's own insertions finds nothing to do, so the loop settles.
  new MutationObserver(update).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'lang'],
  });
  update();
})();
