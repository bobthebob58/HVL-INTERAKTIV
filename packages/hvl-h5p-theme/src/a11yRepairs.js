/**
 * a11yRepairs — gives H5P's own markup the names, roles and labels it lacks, inside every H5P document (player,
 * H5P's iframes, the editor and its content-type list), and keeps them while H5P and the hub's React re-render.
 *
 * Why: D-080. The axe suite (UD-030) found serious and critical barriers in the pinned upstream libraries (D-078);
 *      what a local, attribute-only change removes without changing what H5P does is repaired here, and the register
 *      (apps/server/a11y/support/upstreamRegister.ts) keeps the rest. Each repair was read against the pinned code
 *      (UPSTREAM links): no repaired attribute is one H5P reads back, queries or styles by; names reuse H5P's text.
 * Spec: UD-030, UD-006, UD-011
 * Invariants:
 *   - Attribute-only: never adds or removes nodes, handlers, text, tabindex or classes. The one change of focus order
 *     is `inert` on the parts BranchingScenario's tour fades and already makes unclickable (D-080 amendment).
 *   - Idempotent and cheap: an attribute is written only when it differs, so the observer's next run finds nothing
 *     to do and the loop settles; a second copy of the script does nothing.
 *   - A static same-origin file with no inline code and no eval (D-070 strict policy); never throws into H5P.
 * Collaborators: apps/server/src/h5p/h5pAssets.ts (loads it after Core's scripts into player and editor documents),
 *   apps/server/a11y/support/upstreamRegister.ts (what remains), ./feedbackPrefixes.js (the same loading pattern).
 * Tests: packages/hvl-h5p-theme/test/a11yRepairs.test.ts, packages/hvl-h5p-theme/test/a11yRepairsTour.test.ts,
 *   apps/server/test/h5p/a11yRepairs.browser.int.test.ts, apps/server/a11y/axeContentTypes.a11y.test.ts,
 *   apps/server/a11y/axeEditor.a11y.test.ts, apps/server/a11y/axeWebRoutes.a11y.test.ts
 */
(function hvlA11yRepairs() {
  'use strict';
  if (window.hvlA11yRepairsStarted) return;
  window.hvlA11yRepairsStarted = true;

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
    if (!element.id) element.id = 'hvl-a11y-' + (lastId += 1);
    return element.id;
  }

  function textOf(element) {
    return element ? element.textContent.trim() : '';
  }

  function each(root, selector, repair) {
    var elements = root.querySelectorAll(selector);
    for (var i = 0; i < elements.length; i += 1) repair(elements[i]);
  }

  // UPSTREAM: https://github.com/h5p/h5p-course-presentation/blob/369d140c741fab528604237380c34ec1fe8f121a/src/scripts/navigation-line.js
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

  // UPSTREAM: https://github.com/h5p/h5p-course-presentation/blob/369d140c741fab528604237380c34ec1fe8f121a/src/scripts/slide.js
  // Each slide is the role="tabpanel" of its progress-bar part; with no tab left it would be a panel of nothing, so
  // it becomes a group, still named by its part through H5P's aria-labelledby. No H5P code or CSS uses the role.
  // UPSTREAM: https://github.com/h5p/h5p-components/blob/223a9164259db6f9c1132791671beb1ce4d2c9c2/src/components/h5p-dropzone.js
  // DragText 1.10's drop zones (H5P.Components Dropzone) are role-less <div>s with an aria-label. They become named
  // groups: not buttons, because a dropped word (role="button") sits inside the zone.
  function asGroup(element) {
    set(element, 'role', 'group');
  }

  // UPSTREAM: https://github.com/h5p/h5p-editor-range-list/blob/d1e1118999cedb86bd4f746f8db9dbde8ccbf05c/h5p-editor-range-list.js
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

  // UPSTREAM: https://github.com/h5p/h5p-editor-vertical-tabs/blob/20df230e6b2f052b61a8dfd9b195c6d12a8a9c86/vertical-tabs.js
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

  // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5peditor-semantic-structure.js
  // The editor-mode switch is a <ul> whose items are role="button"; it becomes a group named by its own title
  // ("Redigeringsmodus"), and the active mode, shown only by colour, is announced as pressed. The modes answer a
  // click only (no Enter or Space key): an upstream barrier that attributes cannot remove (D-080).
  function widgetSelect(group) {
    set(group, 'role', 'group');
    each(group, ':scope > li[role="button"]', function repairOption(option) {
      set(option, 'aria-pressed', option.classList.contains('h5peditor-widget-active') ? 'true' : 'false');
    });
  }

  // UPSTREAM: https://github.com/h5p/h5p-editor-image-coordinate-selector/blob/53bd59035df3193d60de571b18be16827ca94c41/scripts/image-coordinate-selector.js
  // The hotspot position picker repeats the background image (whose alternative text has its own field) as a
  // pointer surface; the copy is decorative.
  function pickerImage(image) {
    set(image, 'alt', '');
  }

  // UPSTREAM: https://github.com/h5p/h5p-drag-n-bar/blob/b475daaf1d5de8d967145072388fb4727a7d8e6a/scripts/drag-n-bar.js
  // DragNBar names its element buttons with aria-label, except the paste button, whose name is only its tooltip
  // ("Paste": DragNBar 1.5 has no nn or nb text for it).
  function toolbarButton(link) {
    var tooltip = link.parentElement.querySelector(':scope > .h5p-dragnbar-tooltip');
    if (!textOf(link) && textOf(tooltip)) set(link, 'aria-label', textOf(tooltip));
  }

  // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5p-hub-client.js
  // The hub's content-type list is an <ol> whose items are role="button" (React's keyboard wrapper), so it is no
  // list; it becomes a group named by its heading. React never sets these attributes, so a re-render keeps them.
  function hubList(list) {
    set(list, 'role', 'group');
    var section = list.closest('.h5p-hub-content-type-section');
    var heading = section && section.querySelector('.h5p-hub-result-header');
    if (heading) set(list, 'aria-labelledby', idOf(heading));
  }

  // UPSTREAM: https://github.com/h5p/h5p-editor-branching-scenario/blob/8fcd92d0a5a5f6b855d9d03ce4d19ab31baa4b99/src/scripts/components/Editor.scss
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
    ['.h5p-course-presentation .h5p-progressbar', progressBar],
    ['.h5p-course-presentation .h5p-slide[role="tabpanel"]', asGroup],
    ['[aria-dropeffect][aria-label]:not([role])', asGroup],
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

  // WHY: H5P (and the hub's React) rebuild this markup long after the file runs, and CoursePresentation writes
  // aria-selected again on every slide change, so changes are watched. Repairs that write observed attributes do so
  // only when the value differs, so the run they cause writes nothing and the loop settles.
  new MutationObserver(repairAll).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'role', 'aria-selected', 'aria-label', 'alt'],
  });
  repairAll();
})();
