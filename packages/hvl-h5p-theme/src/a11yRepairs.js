/**
 * a11yRepairs — gives the markup of H5P's content types (what a learner sees in the player) the names, roles and
 * levels it lacks, inside every H5P document, and keeps them while H5P re-renders.
 *
 * Why: D-080. The axe suite (UD-030) found serious and critical barriers in the pinned upstream libraries (D-078);
 *      what a local, attribute-only change removes without changing what H5P does is repaired here, and the register
 *      (apps/server/a11y/support/upstreamRegister.ts) keeps the rest. Each repair was read against the pinned code
 *      (UPSTREAM links): no repaired attribute is one H5P reads back, queries or styles by; names reuse H5P's text.
 *      The repairs of H5P's editor, the hub and their widgets are ./a11yEditorRepairs.js (one file per surface, so
 *      each stays small).
 * Spec: UD-030, UD-006, UD-011
 * Invariants:
 *   - Attribute-only: never adds or removes nodes, handlers, text, tabindex or classes, and changes no focus order.
 *   - Idempotent and cheap: an attribute is written only when it differs, so the observer's next run finds nothing
 *     to do and the loop settles; a second copy of the script does nothing.
 *   - A static same-origin file with no inline code and no eval (D-070 strict policy); never throws into H5P.
 * Collaborators: apps/server/src/h5p/h5pAssets.ts (loads it after Core's scripts into player and editor documents),
 *   apps/server/a11y/support/upstreamRegister.ts (what remains), ./a11yEditorRepairs.js (the editor's repairs, the
 *   same loading pattern), ./feedbackPrefixes.js.
 * Tests: packages/hvl-h5p-theme/test/a11yRepairs.test.ts, apps/server/test/h5p/a11yRepairs.browser.int.test.ts,
 *   apps/server/a11y/axeContentTypes.a11y.test.ts, apps/server/a11y/axeWebRoutes.a11y.test.ts
 */
(function hvlA11yRepairs() {
  'use strict';
  if (window.hvlA11yRepairsStarted) return;
  window.hvlA11yRepairsStarted = true;

  /** Sets (or, for null, removes) an attribute only when that changes it. */
  function set(element, name, value) {
    if (value === null) {
      if (element.hasAttribute(name)) element.removeAttribute(name);
    } else if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value);
    }
  }

  function textOf(element) {
    return element ? element.textContent.trim() : '';
  }

  function each(root, selector, repair) {
    var elements = root.querySelectorAll(selector);
    for (var i = 0; i < elements.length; i += 1) repair(elements[i]);
  }

  // UPSTREAM: https://github.com/h5p/h5p-course-presentation/blob/369d140c741fab528604237380c34ec1fe8f121a/src/scripts/navigation-line.js (no issue filed yet; SPEC-DEVIATION: D-080 amendment DOC-13 (a) says when this repair goes)
  // CoursePresentation 1.28 writes a role="tablist" of role="tab" <div>s, each holding the focusable <a> that its
  // keyboard controls move between, and an empty text span for slides without tasks. The <div> keeps its
  // aria-label, which H5P.Tooltip reads (Core h5p-tooltip.js), so it cannot become presentational; the bar is a
  // list of links instead, the current slide marked aria-current="step" (aria-selected is not allowed on a list
  // item; H5P only writes it). A link without text is named by its slide's title. cp.js creates the summary slide
  // without an index (id "slide-undefined"), so its part's aria-controls="slide-<n>" points at no element; that
  // dangling reference is dropped.
  function progressBar(bar) {
    set(bar, 'role', 'list');
    each(bar, ':scope > .h5p-progressbar-part', function repairPart(part) {
      var controls = part.getAttribute('aria-controls');
      set(part, 'role', 'listitem');
      set(part, 'aria-selected', null);
      if (controls && !document.getElementById(controls)) set(part, 'aria-controls', null);
      var link = part.querySelector(':scope > a');
      if (!link) return;
      set(link, 'aria-current', part.classList.contains('h5p-progressbar-part-selected') ? 'step' : null);
      set(link, 'aria-label', textOf(link) ? null : part.getAttribute('aria-label'));
    });
  }

  // UPSTREAM: https://github.com/h5p/h5p-course-presentation/blob/369d140c741fab528604237380c34ec1fe8f121a/src/scripts/slide.js (no issue filed yet; SPEC-DEVIATION: D-080 amendment DOC-13 (b) says when this repair goes)
  // Each slide is the role="tabpanel" of its progress-bar part; with no tab left it would be a panel of nothing, so
  // it becomes a group, still named by its part through H5P's aria-labelledby. No H5P code or CSS uses the role.
  // UPSTREAM: https://github.com/h5p/h5p-components/blob/223a9164259db6f9c1132791671beb1ce4d2c9c2/src/components/h5p-dropzone.js (no issue filed yet; SPEC-DEVIATION: D-080 amendment DOC-13 (c) says when this repair goes)
  // DragText 1.10's drop zones (H5P.Components Dropzone) are role-less <div>s with an aria-label. They become named
  // groups: not buttons, because a dropped word (role="button") sits inside the zone.
  function asGroup(element) {
    set(element, 'role', 'group');
  }

  // UPSTREAM: https://github.com/h5p/h5p-question/blob/fffb3c86f5289b1d24adfd7343559a4f03ba81d5/scripts/explainer.js (no issue filed yet; SPEC-DEVIATION: D-080 amendment DOC-13 (k) says when this repair goes)
  // H5P.Question 1.5's explanation of a checked answer (DragText's "Forklaring") has a title <div role="heading">
  // with no aria-level, which ARIA 1.2 requires (axe aria-required-attr, critical). It becomes a level-2 heading:
  // the player document has no heading of its own, and the page around it gives the activity's title as its h1.
  function explanationTitle(element) {
    set(element, 'aria-level', '2');
  }

  // UPSTREAM: https://github.com/h5p/h5p-branching-scenario/blob/6860e97e916054c09e9f2c4bb824ca958521213a/src/scripts/genericScreen.js (no issue filed yet; SPEC-DEVIATION: D-080 amendment of 2026-10-28 says why; the repair goes when a pinned BranchingScenario writes an alt itself)
  // Without a start or end image, BranchingScenario 1.10 shows its own default pictures (dist/assets/*-screen-
  // default.jpg) as an <img> with no alt (WCAG 1.1.1). They are decorative, so they get alt="". An author's image
  // keeps H5P's markup: V-IMG-ALT asks the author for its alt text, which H5P writes as aria-label.
  var DEFAULT_PICTURE = /\/dist\/assets\/(?:start|end)-screen-default\.jpg$/;
  function defaultPicture(image) {
    if (DEFAULT_PICTURE.test(image.getAttribute('src') || '')) set(image, 'alt', '');
  }

  var REPAIRS = [
    ['.h5p-course-presentation .h5p-progressbar', progressBar],
    ['.h5p-course-presentation .h5p-slide[role="tabpanel"]', asGroup],
    ['[aria-dropeffect][aria-label]:not([role])', asGroup],
    ['.h5p-question-explanation-title[role="heading"]:not([aria-level])', explanationTitle],
    ['img.h5p-background-image:not([alt]):not([aria-label])', defaultPicture],
  ];

  function repairAll() {
    REPAIRS.forEach(function run(entry) {
      try {
        each(document, entry[0], entry[1]);
      } catch {
        // WHY: a repair must never break H5P; a markup it does not expect stays as H5P wrote it.
      }
    });
  }

  // WHY: H5P rebuilds this markup long after the file runs, and CoursePresentation writes aria-selected again on
  // every slide change, so changes are watched. Repairs that write observed attributes do so only when the value
  // differs, so the run they cause writes nothing and the loop settles.
  new MutationObserver(repairAll).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'role', 'aria-selected', 'aria-label', 'aria-level'],
  });
  repairAll();
})();
