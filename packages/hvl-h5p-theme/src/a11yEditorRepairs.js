/**
 * a11yEditorRepairs — gives the markup of H5P's editor (its widgets, the content types' editors and the hub's
 * content-type list) the names, roles and labels it lacks, inside every H5P document, and keeps them while H5P and
 * the hub's React re-render.
 *
 * Why: D-080, as ./a11yRepairs.js does for the content types' own markup. The axe suite (UD-030) found serious and
 *      critical barriers in the pinned upstream editor libraries (D-078); what a local, attribute-only change removes
 *      without changing what H5P does is repaired here, and the register (apps/server/a11y/support/upstreamRegister.ts)
 *      keeps the rest. Each repair was read against the pinned code (UPSTREAM links): no repaired attribute is one H5P
 *      reads back, queries or styles by; names reuse H5P's text.
 * Spec: UD-030, UD-006, UD-011
 * Invariants:
 *   - Attribute-only: never adds or removes nodes, handlers, text, tabindex or classes. The one change of focus order
 *     is `inert` on the parts BranchingScenario's tour fades and already makes unclickable (D-080 amendment).
 *   - Idempotent and cheap: an attribute is written only when it differs, so the observer's next run finds nothing
 *     to do and the loop settles; a second copy of the script does nothing.
 *   - A static same-origin file with no inline code and no eval (D-070 strict policy); never throws into H5P.
 * Collaborators: apps/server/src/h5p/h5pAssets.ts (loads it after ./a11yRepairs.js into player and editor
 *   documents), apps/server/a11y/support/upstreamRegister.ts (what remains), ./a11yRepairs.js (the same pattern).
 * Tests: packages/hvl-h5p-theme/test/a11yEditorRepairs.test.ts, packages/hvl-h5p-theme/test/a11yRepairsTour.test.ts,
 *   apps/server/test/h5p/a11yRepairs.browser.int.test.ts, apps/server/test/h5p/branchingTour.browser.int.test.ts,
 *   apps/server/a11y/axeEditor.a11y.test.ts
 */
(function hvlA11yEditorRepairs() {
  'use strict';
  if (window.hvlA11yEditorRepairsStarted) return;
  window.hvlA11yEditorRepairsStarted = true;

  var lastId = 0;

  /** Sets (or, for null, removes) an attribute only when that changes it. */
  function set(element, name, value) {
    if (value === null) {
      if (element.hasAttribute(name)) element.removeAttribute(name);
    } else if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value);
    }
  }

  /** The element's ID, giving it one first if it has none (IDs are not observed, so this causes no new run). */
  function idOf(element) {
    if (!element.id) element.id = 'hvl-a11y-editor-' + (lastId += 1);
    return element.id;
  }

  function textOf(element) {
    return element ? element.textContent.trim() : '';
  }

  function each(root, selector, repair) {
    var elements = root.querySelectorAll(selector);
    for (var i = 0; i < elements.length; i += 1) repair(elements[i]);
  }

  // UPSTREAM: https://github.com/h5p/h5p-editor-range-list/blob/d1e1118999cedb86bd4f746f8db9dbde8ccbf05c/h5p-editor-range-list.js (no issue filed yet; SPEC-DEVIATION: D-080 amendment DOC-13 (d) says when this repair goes)
  // The "to" field of each score range has an empty <label> (TableList moves labels into the column headings, and
  // the "to" column has none). It is named by the score-range heading, the row's "from" value and the dash, as the
  // row reads on screen: "Poengområde* 51 % –" in MultiChoice, the "*" being H5P's required marker (CSS ::after).
  function rangeList(table) {
    var heading = table.querySelector(':scope > thead > tr > th');
    if (!heading) return;
    each(table, ':scope > tbody > tr', function repairRow(row) {
      var cells = row.children;
      var to = cells[2] && cells[2].querySelector('input');
      if (!to) return;
      var from = cells[0] && cells[0].querySelector('.h5peditor-input-text');
      var parts = [heading, from, cells[1]].filter(Boolean).map(idOf);
      set(to, 'aria-labelledby', parts.join(' '));
    });
  }

  // UPSTREAM: https://github.com/h5p/h5p-editor-vertical-tabs/blob/20df230e6b2f052b61a8dfd9b195c6d12a8a9c86/vertical-tabs.js (no issue filed yet; SPEC-DEVIATION: D-080 amendment DOC-13 (e) says when this repair goes)
  // The "tabs" sit in <li>s of an <ol role="tablist"> next to each item's remove and order buttons, which a tab
  // list may not contain. The <ol> is a list again and each "tab" a button (it already opens its item on Space,
  // which stays; Enter never did), the open item marked aria-current. Each item's form, a <fieldset
  // role="tabpanel">, loses the role and is a native group again. H5P finds them by class, never by role.
  function verticalTabs(list) {
    set(list, 'role', 'list');
    each(list, ':scope > .h5p-vtab-li > .h5p-vtab-a', function repairTab(tab) {
      set(tab, 'role', 'button');
      set(tab, 'aria-current', tab.parentElement.classList.contains('h5p-current') ? 'true' : null);
    });
  }

  function verticalTabForm(form) {
    set(form, 'role', null);
  }

  // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5peditor-semantic-structure.js (no issue filed yet; SPEC-DEVIATION: D-080 amendment DOC-13 (f) says when this repair goes)
  // The editor-mode switch is a <ul> whose items are role="button"; it becomes a group named by its own title
  // ("Redigeringsmodus"), and the active mode, shown only by colour, is announced as pressed. The modes answer a
  // click only (no Enter or Space key): an upstream barrier that attributes cannot remove (D-080).
  function widgetSelect(group) {
    set(group, 'role', 'group');
    each(group, ':scope > li[role="button"]', function repairOption(option) {
      set(option, 'aria-pressed', option.classList.contains('h5peditor-widget-active') ? 'true' : 'false');
    });
  }

  // UPSTREAM: https://github.com/h5p/h5p-editor-image-coordinate-selector/blob/53bd59035df3193d60de571b18be16827ca94c41/scripts/image-coordinate-selector.js (no issue filed yet; SPEC-DEVIATION: D-080 amendment DOC-13 (g) says when this repair goes)
  // The hotspot position picker repeats the background image (whose alternative text has its own field) as a
  // pointer surface; the copy is decorative.
  function pickerImage(image) {
    set(image, 'alt', '');
  }

  // UPSTREAM: https://github.com/h5p/h5p-drag-n-bar/blob/b475daaf1d5de8d967145072388fb4727a7d8e6a/scripts/drag-n-bar.js (no issue filed yet; SPEC-DEVIATION: D-080 amendment DOC-13 (h) says when this repair goes)
  // DragNBar names its element buttons with aria-label, except the paste button, whose name is only its tooltip
  // ("Paste": DragNBar 1.5 has no nn or nb text for it).
  function toolbarButton(link) {
    var tooltip = link.parentElement.querySelector(':scope > .h5p-dragnbar-tooltip');
    if (!textOf(link) && textOf(tooltip)) set(link, 'aria-label', textOf(tooltip));
  }

  // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5p-hub-client.js (no issue filed yet; SPEC-DEVIATION: D-080 amendment DOC-13 (i) says when this repair goes)
  // The hub's content-type list is an <ol> whose items are role="button" (React's keyboard wrapper), so it is no
  // list; it becomes a group named by its heading. React never sets these attributes, so a re-render keeps them.
  function hubList(list) {
    set(list, 'role', 'group');
    var section = list.closest('.h5p-hub-content-type-section');
    var heading = section && section.querySelector('.h5p-hub-result-header');
    if (heading) set(list, 'aria-labelledby', idOf(heading));
  }

  // UPSTREAM: https://github.com/h5p/h5p-editor-branching-scenario/blob/8fcd92d0a5a5f6b855d9d03ce4d19ab31baa4b99/src/scripts/components/Editor.scss (no issue filed yet; SPEC-DEVIATION: D-080 amendment DOC-13 (j) says when this repair goes)
  // While BranchingScenario's guided tour shows a step, the editor fades the rest (`.tour-fade`: opacity .15 and
  // pointer-events: none), but keyboard and screen-reader users still reach the faded, all but invisible controls.
  // Each faded part is inert while it has the class, as H5P's pointer-events intend (D-080 amendment); the tour's
  // own dialog is never inside one. `data-hvl-inert` marks what this repair made inert, so only that is given back.
  function tourFade(element) {
    var faded = element.classList.contains('tour-fade');
    set(element, 'inert', faded ? '' : null);
    set(element, 'data-hvl-inert', faded ? '' : null);
  }

  var REPAIRS = [
    ['table.h5p-editor-range-list', rangeList],
    ['.h5p-vtabs-container > ol', verticalTabs],
    ['.h5p-vtab-forms > fieldset.h5p-vtab-form[role="tabpanel"]', verticalTabForm],
    ['ul.h5peditor-widget-select', widgetSelect],
    ['.image-coordinate-selector > img:not([alt])', pickerImage],
    ['.h5p-dragnbar-li > a.h5p-dragnbar-a:not([aria-label]):not([title])', toolbarButton],
    ['.h5p-hub-content-type-list > ol', hubList],
    ['.tour-fade, [data-hvl-inert]', tourFade],
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

  // WHY: H5P and the hub's React rebuild this markup long after the file runs, so changes are watched. Repairs that
  // write observed attributes do so only when the value differs, so the run they cause writes nothing and it settles.
  new MutationObserver(repairAll).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'role', 'aria-label', 'alt'],
  });
  repairAll();
})();
