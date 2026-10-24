/**
 * editorFieldReveal — opens what hides a field in H5P's editor: groups, tabs, wizard steps, an interaction's form, a
 * DragNBar sub-form over it, and a guided tour that fades the editor.
 *
 * Why: "Gå til feltet" (PROD-003, UD-021) focuses the field a finding names, and a field in a closed group, a hidden
 *      tab or step, or under an open sub-form cannot take focus. Custom editors keep fields in their own places
 *      (UPSTREAM notes below). ./editorFields.js follows the path and calls `hvliRevealField`.
 * Spec: PROD-003, UD-006, UD-021
 * Invariants:
 *   - It opens only what an author opens by hand (groups, tabs, wizard steps, an interaction's form, a guided tour's
 *     "I got it"); it closes only the open sub-forms of a DragNBar form manager (InteractiveVideo,
 *     CoursePresentation) that hide the field, as their first breadcrumb does (values kept).
 *   - Each part found is given as its own element: a widget's own, its `field-name-` wrapper, or a list's wrapper
 *     (found by the list element's ID); the whole form stands in only for a custom editor and never counts as the
 *     field's own.
 *   - The functions touch only the widgets and elements they are given.
 *   - Each UPSTREAM note links the pinned source of the editor code it relies on; no issue is filed, since it records
 *     how that code works, not a bug (D-080 amendment of 2026-10-24, V2D-5). A note goes when a pinned version
 *     changes that behaviour, which the browser tests named below then catch.
 * Collaborators: ./editorFields.js (loaded after this file), ../editorPage.ts (loads both).
 * Tests: apps/server/test/h5p/render/editorFieldChain.test.ts, apps/server/test/h5p/render/editorFieldsScript.test.ts,
 *   apps/server/test/h5p/editorGoToField.browser.int.test.ts, apps/server/test/h5p/editorGoToFieldEarly.browser.int.test.ts
 */
'use strict';
/* exported hvliOpenStep, hvliOpenAround, hvliRevealField */

/** Where a widget keeps its element, in order of preference (a library's sub-form before its copy buttons). */
var HVLI_OWN_ELEMENTS = ['$input', '$item', '$group', '$libraryWrapper', '$myField', '$form'];

/** Closes the sub-forms open in a DragNBar form manager (InteractiveVideo, CoursePresentation), keeping values. */
function hvliCloseForms(manager) {
  // UPSTREAM: https://github.com/h5p/h5p-drag-n-bar/blob/b475daaf1d5de8d967145072388fb4727a7d8e6a/scripts/drag-n-bar-form-manager.js
  // While a sub-form is open (no `root-form`), the rest is hidden; the first breadcrumb closes them all.
  if (manager && !manager.classList.contains('root-form'))
    manager.querySelector('.form-manager-breadcrumb > .clickable:first-child')?.click();
}

/** Shows the wizard step or InteractiveVideo form of `parent` holding `widget`; true while a form still closes. */
function hvliOpenStep(parent, widget) {
  // UPSTREAM: https://github.com/h5p/h5p-editor-wizard/blob/4cdf5d26d998daf10191fa4dcc1fb9b2192f3dd6/Scripts/Wizard.js
  // A wizard shows one step (child) at a time; `showTab` is what its step links call.
  if (parent && typeof parent.showTab === 'function' && parent.$tabs && Array.isArray(parent.children)) {
    var tab = parent.$tabs.eq(parent.children.indexOf(widget));
    if (tab.length === 1 && !tab.hasClass('h5peditor-active')) parent.showTab(tab);
  }
  // WHY: the editing dialog (as a double-click opens it) needs the toolbar, and opens once no other form is left:
  // opened while one still slides out, the form manager would make that form's breadcrumb the way back.
  var editor = parent && parent.hvliInteractionsOf;
  var formElement = widget.$form && widget.$form[0];
  if (!editor || !editor.dnb || !formElement || formElement.isConnected) return false;
  var manager = editor.$item && editor.$item[0].closest('.form-manager');
  hvliCloseForms(manager);
  var closing = manager?.querySelector(':scope > .form-manager-form, .form-manager-breadcrumb > * + *');
  if (manager && !closing) editor.openInteractionDialog(widget);
  return Boolean(closing);
}

/** Opens what holds `element` (a sub-form over it, groups, vertical tabs, BranchingScenario's); true if a tour was up. */
function hvliOpenAround(element) {
  if (!element.closest('.form-manager-form')) hvliCloseForms(element.closest('.form-manager'));
  var group = element.closest('fieldset.group');
  for (; group; group = group.parentElement.closest('fieldset.group'))
    group.querySelector(':scope > .title[aria-expanded="false"]')?.click();
  var form = element.closest('.h5p-vtab-form');
  for (; form; form = form.parentElement.closest('.h5p-vtab-form')) {
    var tabs = form.closest('.h5p-vtab-wrapper').querySelectorAll(':scope > .h5p-vtabs .h5p-vtab-li');
    var tab = tabs[Array.prototype.indexOf.call(form.parentElement.children, form)];
    if (tab) element.ownerDocument.defaultView.H5P.jQuery(tab).trigger('open');
  }
  // UPSTREAM: https://github.com/h5p/h5p-editor-branching-scenario/blob/8fcd92d0a5a5f6b855d9d03ce4d19ab31baa4b99/src/scripts/components/Tour.js
  // A guided tour fades the editor (inert, D-080) until its "I got it" (`.tour-button`) is pressed.
  var tour = element.ownerDocument.querySelector('.bswrapper .tour-button');
  tour?.click();
  // UPSTREAM: https://github.com/h5p/h5p-editor-branching-scenario/blob/8fcd92d0a5a5f6b855d9d03ce4d19ab31baa4b99/src/scripts/components/TabPanel.js
  // The tabs are <li>s with a click handler, one per `.tab-panel` in order; only the `.active` panel is shown.
  var panel = element.closest('.tabs > .tab-panel:not(.active)');
  var panels = panel ? [...panel.parentElement.querySelectorAll(':scope > .tab-panel')] : [];
  if (panel) panel.parentElement.querySelectorAll(':scope > .tabs-nav > li')[panels.indexOf(panel)]?.click();
  return Boolean(tour);
}

/** Opens what hides the chain; returns the element of each part found, deepest last, and if it reaches the field. */
function hvliRevealField(form, widgets, rest) {
  var root = form && form.$form ? form.$form[0] : null;
  var scopes = [];
  var again = false;
  widgets.forEach(function (widget, index) {
    // WHY: a group H5P never rendered as a fieldset (a RangeList row) has no title, and its expand() throws then.
    if (typeof widget.expand === 'function' && widget.$title) widget.expand();
    again = hvliOpenStep(index > 0 ? widgets[index - 1] : form, widget) || again;
    var own = HVLI_OWN_ELEMENTS.map((name) => widget[name] && widget[name][0]).find(Boolean);
    var within = scopes[scopes.length - 1] || root;
    var named = within && widget.field ? within.querySelector('.field-name-' + widget.field.name) : null;
    // WHY: a list's wrapper has no `field-name-` class; its list element (ListEditor, VerticalTabs) has the list's ID.
    var list = widget.getId && root?.ownerDocument.getElementById(widget.getId())?.closest('.field');
    if (own || named || list) scopes.push(own || named || list);
  });
  // WHY: a custom editor that keeps no element of its own (BranchingScenario's) is the whole form here; the form is
  // never the field's own, so a path that ends there is not complete.
  if (scopes.length === 0 && widgets.length > 0 && root) scopes.push(root);
  // WHY: past a wrapper that hides its widget (showWhen), the rest is found by H5P's `field-name-` classes, but
  // only by name: the first match for a list position could be another item's.
  var complete = rest.every(function (token, index) {
    var named = typeof token === 'string' ? scopes.at(-1)?.querySelector('.field-name-' + token) : null;
    if (named) scopes.push(named);
    return typeof token === 'string' && (Boolean(named) || index < rest.length - 1);
  });
  if (scopes.length > 0) hvliOpenAround(scopes[scopes.length - 1]);
  return { scopes: scopes, complete: complete && widgets.length > 0 && scopes.at(-1) !== root, again: again };
}
