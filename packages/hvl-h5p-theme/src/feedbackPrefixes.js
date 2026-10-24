/**
 * feedbackPrefixes — adds the "Riktig:" / "Feil:" label (or the en label) to every correct or incorrect answer
 * inside an H5P document, and keeps it in step while H5P changes the page.
 *
 * Why: UD-003 asks that screen readers announce the state of an answer as text, not by colour. The theme shows
 *      "✓ Riktig:" with CSS `::before`, but generated content is not announced reliably, so the visible prefix has
 *      empty alternative text and this script adds the label as a real, visually hidden text node. Where a library
 *      uses the answer's pseudo-elements itself (TrueFalse, Summary, MultiMediaChoice), the label is shown as text
 *      instead (`--hvl-feedback-*-shown`), so one node is both the visible and the announced prefix. A radio,
 *      checkbox, option or button named by `aria-label` does not read its content, so for an answer inside one
 *      the label also goes in front of that name, unless the name already states it as H5P writes it ("Feil. …").
 *      Targets and labels come from ../dist/hvl-feedback-prefixes.css (custom properties), so the language follows
 *      `:lang()` exactly as the visible prefix does (UD-010) and no list is written twice.
 * Spec: UD-003, UD-010
 * Invariants:
 *   - Idempotent: a target has at most one label, as its first child; running again changes nothing.
 *   - A label disappears when its element is no longer in that state (retry) and changes with the language; a
 *     name this script extended gets its original back then.
 *   - A static same-origin file with no inline code and no eval (D-070 strict policy); it runs once per document.
 *   - Never throws into H5P: an unknown selector or a missing stylesheet leaves the page as it is.
 * Collaborators: ../dist/hvl-feedback-prefixes.css (targets and labels), ./hvl-h5p-feedback.css (`.hvl-feedback-sr`,
 *   `.hvl-feedback-text`), apps/server/src/h5p/h5pAssets.ts (loads it into the player, H5P's iframes and the editor).
 * Tests: packages/hvl-h5p-theme/test/feedbackPrefixes.test.ts, packages/hvl-h5p-theme/test/feedbackNames.test.ts,
 *   apps/server/test/h5p/hvlFeedback.browser.int.test.ts, apps/server/test/h5p/hvlFeedbackContainers.browser.int.test.ts,
 *   apps/server/test/h5p/hvlFeedbackHotspot.browser.int.test.ts
 */
(function hvlFeedbackPrefixes() {
  'use strict';
  if (window.hvlFeedbackPrefixesStarted) return;
  window.hvlFeedbackPrefixesStarted = true;

  var HIDDEN_CLASS = 'hvl-feedback-sr';
  // SPEC-DEVIATION: D-072 — UD-003 names a ::before prefix plus a hidden text node; where the library uses the
  // answer's pseudo-elements (TrueFalse, Summary, MultiMediaChoice), one shown text node is both.
  var SHOWN_CLASS = 'hvl-feedback-text';
  var STATES = ['correct', 'incorrect'];
  var NAMED_WIDGET =
    '[role=radio][aria-label], [role=checkbox][aria-label], [role=option][aria-label], ' +
    '[role=button][aria-label], button[aria-label]';
  /** Widgets whose aria-label this script extended → { original, written }. */
  var named = new Map();

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

  function isLabel(node) {
    return (
      Boolean(node) &&
      node.nodeType === 1 &&
      (node.classList.contains(HIDDEN_CLASS) || node.classList.contains(SHOWN_CLASS))
    );
  }

  /** Removes labels whose element left its state, changed how it shows them or no longer has them first. */
  function removeStale(lists) {
    var labels = document.querySelectorAll('.' + HIDDEN_CLASS + ', .' + SHOWN_CLASS);
    for (var i = 0; i < labels.length; i += 1) {
      var label = labels[i];
      var parent = label.parentElement;
      var state = label.getAttribute('data-hvl-feedback');
      var list = lists[state];
      var current = list && parent && parent.firstChild === label && matches(parent, list.targets);
      if (!current || matches(parent, list.shown) !== label.classList.contains(SHOWN_CLASS)) label.remove();
    }
  }

  /** Makes the target's first child its label; returns the label text ('' without a stylesheet). */
  function ensureLabel(target, state, shown) {
    var text = labelFor(target, state);
    if (!text) return '';
    var className = shown ? SHOWN_CLASS : HIDDEN_CLASS;
    var first = target.firstChild;
    if (isLabel(first)) {
      var same = first.getAttribute('data-hvl-feedback') === state && first.className === className;
      if (same && first.textContent === text + ' ') return text;
      first.remove();
    }
    var label = document.createElement('span');
    label.className = className;
    label.setAttribute('data-hvl-feedback', state);
    label.textContent = text + ' ';
    target.insertBefore(label, target.firstChild);
    return text;
  }

  /**
   * Whether a name already states the answer's state the way H5P writes it: the label's word and a full stop, as
   * Summary's "Feil. Påstanden …" for "Feil:". A name that merely begins with the word (an alt text such as
   * "Riktig handplassering") still gets the label.
   */
  function namesState(name, text) {
    var start = name.trim().toLowerCase();
    return start.indexOf(text.replace(/:$/, '').toLowerCase() + '.') === 0;
  }

  function restoreName(widget) {
    var entry = named.get(widget);
    if (entry && widget.getAttribute('aria-label') === entry.written) {
      widget.setAttribute('aria-label', entry.original);
    }
    named.delete(widget);
  }

  /** Puts the label in front of the widget's aria-label, remembering the name H5P gave it. */
  function nameWidget(widget, text) {
    var current = widget.getAttribute('aria-label') || '';
    var entry = named.get(widget);
    var original = entry && current === entry.written ? entry.original : current;
    if (namesState(original, text)) {
      restoreName(widget);
      return;
    }
    var written = text + ' ' + original;
    named.set(widget, { original: original, written: written });
    if (current !== written) widget.setAttribute('aria-label', written);
  }

  function update() {
    var lists = {};
    var root = document.documentElement;
    STATES.forEach(function readLists(state) {
      lists[state] = {
        targets: property(root, '--hvl-feedback-' + state + '-targets'),
        shown: property(root, '--hvl-feedback-' + state + '-shown'),
      };
    });
    removeStale(lists);
    var names = new Map();
    STATES.forEach(function addLabels(state) {
      var targets = targetsOf(lists[state].targets);
      for (var i = 0; i < targets.length; i += 1) {
        var text = ensureLabel(targets[i], state, matches(targets[i], lists[state].shown));
        var widget = text && targets[i].closest(NAMED_WIDGET);
        if (widget) names.set(widget, text);
      }
    });
    named.forEach(function forget(_entry, widget) {
      if (!names.has(widget)) restoreName(widget);
    });
    names.forEach(function name(text, widget) {
      nameWidget(widget, text);
    });
  }

  // WHY: H5P builds and re-renders its DOM long after this file runs (on check, retry and navigation), so changes
  // are watched for; the update after the script's own changes finds nothing to do, so the loop settles.
  new MutationObserver(update).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'lang', 'aria-label', 'aria-describedby'],
  });
  update();
})();
