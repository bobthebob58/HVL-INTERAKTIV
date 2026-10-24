/**
 * editorFields — follows a finding's path through H5P's editor widgets, opens what hides the field and focuses it.
 *
 * Why: "Gå til feltet" (PROD-003, UD-021) takes the author from a finding to the field it names. H5P builds forms,
 *      lists and sub-content forms asynchronously (each after its library loads, often only once a click opens the
 *      tab), so the field may not exist yet; custom editors keep fields in their own places (UPSTREAM notes below).
 * Spec: PROD-003, UD-006, UD-021
 * Invariants:
 *   - It waits only while H5P is still building (no form yet, the deepest widget's library loading, no IV toolbar
 *     yet, a form it closed still sliding out), at most 20 s; once nothing loads, a path that leads no further
 *     (metadata, CoursePresentation's slides, BranchingScenario's nodes) gets one second.
 *   - Focus goes to a shown control that takes focus: the field's own (CKEditor's editable once it stands in for
 *     an Html field), else the closest part's found along the path, else `page.fallback()`; whenever it is not
 *     the field's own, `page.notReached()` is called.
 *   - It opens only what an author opens by hand (groups, tabs, wizard steps, an interaction's form, the "I got it"
 *     of a guided tour that fades the editor). It closes only the open sub-forms of a DragNBar form manager
 *     (InteractiveVideo, CoursePresentation) that hide the field, as their first breadcrumb does (values kept).
 *   - The functions touch only the widgets and elements they are given.
 * Collaborators: ./editorPage.js (calls `hvliGoToField`), ../editorPage.ts (loads this file before it).
 * Tests: apps/server/test/h5p/render/editorFieldsScript.test.ts, apps/server/test/h5p/render/editorFieldChain.test.ts,
 *   apps/server/test/h5p/editorGoToField.browser.int.test.ts, apps/server/test/h5p/editorBlockedSave.browser.int.test.ts
 */
'use strict';
/* exported hvliGoToField */

var HVLI_FOCUSABLE =
  'input:not([type=hidden]):not(:disabled),textarea:not(:disabled),select:not(:disabled),' +
  'button:not(:disabled),[contenteditable="true"],[tabindex]';
/** Where a widget keeps its element, in order of preference (a library's sub-form before its copy buttons). */
var HVLI_OWN_ELEMENTS = ['$input', '$item', '$group', '$libraryWrapper', '$myField', '$form'];
var HVLI_FIELD_WAIT = { stepMs: 250, maxTries: 80, graceTries: 5 }; // 20 s at most, 1 s once nothing loads

/** Splits a finding path into names and list positions; `params` names no widget (sub-content shows them itself). */
function hvliFieldTokens(path) {
  var cleaned = String(path).replace(/\.params(?=[.[]|$)/g, '');
  return (cleaned.match(/\[\d+\]|[^.[\]]+/g) || []).map((p) => (p[0] === '[' ? Number(p.slice(1, -1)) : p));
}

/** The widgets under `node` that a path token can name, wherever the editor keeps them. */
function hvliChildrenOf(node) {
  // UPSTREAM: https://github.com/h5p/h5p-editor-interactive-video/blob/205abc173eece12046c4dedbe883ea5835e49151/Scripts/interactive-video-editor.js
  // The editor keeps each interaction's widgets on the player's interaction (`processInteraction`), not as children.
  if (node.IV && Array.isArray(node.IV.interactions) && typeof node.openInteractionDialog === 'function')
    return [{ field: { name: 'interactions' }, children: node.IV.interactions, hvliInteractionsOf: node }];
  if (node.children) return node.children;
  var children = [];
  try {
    node.forEachChild((child) => void children.push(child));
  } catch {
    // WHY: a library widget has no children until its library has loaded, and its forEachChild throws until then.
  }
  return children;
}

/** True for a group of one field that is not sub-content: H5P stores that field's value as the group's own. */
function hvliFlattened(node) {
  if (typeof node.hasSingleChild !== 'function' || !node.hasSingleChild() || !node.children) return false;
  return !(typeof node.isSubContent === 'function' && node.isSubContent());
}

/** Follows the tokens through the editor's widgets: those found, outermost first, and how many tokens they cover. */
function hvliFieldChain(form, tokens) {
  var widgets = [];
  var node = form;
  var missing = tokens.findIndex(function (token) {
    node = hvliChildrenOf(node).find((c, i) => i === token || (c && c.field && c.field.name === token));
    // WHY: the path skips a one-field group (e.g. an InteractiveBook page), so its one field is taken with it.
    for (; node && hvliFlattened(node); node = node.children[0]) widgets.push(node);
    if (node) widgets.push(node);
    return !node;
  });
  return { widgets: widgets, used: missing < 0 ? tokens.length : missing };
}

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

/** Opens what holds `element`: an open sub-form over it, groups found by class, vertical tabs, BranchingScenario's. */
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
  element.ownerDocument.querySelector('.bswrapper .tour-button')?.click();
  // UPSTREAM: https://github.com/h5p/h5p-editor-branching-scenario/blob/8fcd92d0a5a5f6b855d9d03ce4d19ab31baa4b99/src/scripts/components/TabPanel.js
  // The tabs are <li>s with a click handler, one per `.tab-panel` in order; only the `.active` panel is shown.
  var panel = element.closest('.tabs > .tab-panel:not(.active)');
  var panels = panel ? [...panel.parentElement.querySelectorAll(':scope > .tab-panel')] : [];
  if (panel) panel.parentElement.querySelectorAll(':scope > .tabs-nav > li')[panels.indexOf(panel)]?.click();
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
    if (own || named) scopes.push(own || named);
  });
  // WHY: a custom editor that keeps no element of its own (BranchingScenario's) is the whole form here.
  if (scopes.length === 0 && widgets.length > 0 && root) scopes.push(root);
  // WHY: past a wrapper that hides its widget (showWhen), the rest is found by H5P's `field-name-` classes, but
  // only by name: the first match for a list position could be another item's.
  var complete = rest.every(function (token, index) {
    var named = typeof token === 'string' ? scopes.at(-1)?.querySelector('.field-name-' + token) : null;
    if (named) scopes.push(named);
    return typeof token === 'string' && (Boolean(named) || index < rest.length - 1);
  });
  if (scopes.length > 0) hvliOpenAround(scopes[scopes.length - 1]);
  return { scopes: scopes, complete: complete && widgets.length > 0, again: again };
}

/** True when the element is rendered and not hidden (a closed group, tab, step or form). */
function hvliShown(element) {
  if (typeof element.checkVisibility !== 'function') return element.getClientRects().length > 0;
  return element.checkVisibility({ visibilityProperty: true });
}

/** Focuses the first shown control in `scope`, or CKEditor's editable standing in for it; true when one took focus. */
function hvliFocusIn(scope) {
  // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5peditor-html.js
  // ClassicEditor hides an Html field's `.ckeditor` and shows its editor next to it until another Html field is used.
  var source = scope.classList.contains('ckeditor') ? scope : scope.querySelector(':scope > .ckeditor');
  var editable = source && source.parentElement.querySelector(':scope > .ck-editor .ck-editor__editable');
  var own = editable && !hvliShown(source) ? editable : scope;
  var focusable = (el) => el.matches(HVLI_FOCUSABLE) && hvliShown(el);
  var control = [own, ...own.querySelectorAll(HVLI_FOCUSABLE)].find(focusable);
  if (!control) return false;
  control.focus();
  return control.contains(control.ownerDocument.activeElement);
}

/** True while H5P is still building the field: no form yet, a library still loading, or IV's toolbar missing. */
function hvliStillBuilding(form, chain) {
  var last = chain.length > 0 ? chain[chain.length - 1] : form;
  if (!last) return true;
  if (chain.slice(0, -1).some((w) => w.hvliInteractionsOf && !w.hvliInteractionsOf.dnb)) return true;
  var library = last.currentLibrary;
  return typeof library === 'string' && library !== '-' && last.children === undefined;
}

/** Follows `path` in the form `formOf()` gives, waiting while H5P builds it; focuses the field, or the closest part. */
function hvliGoToField(formOf, path, page, tries, grace) {
  var form = formOf();
  var tokens = hvliFieldTokens(path);
  var found = form ? hvliFieldChain(form, tokens) : { widgets: [], used: 0 };
  var left = tries ?? HVLI_FIELD_WAIT.maxTries;
  var building = hvliStillBuilding(form, found.widgets);
  var graceLeft = building ? HVLI_FIELD_WAIT.graceTries : (grace ?? HVLI_FIELD_WAIT.graceTries) - 1;
  var wait = () => setTimeout(hvliGoToField, HVLI_FIELD_WAIT.stepMs, formOf, path, page, left - 1, graceLeft);
  if ((building || found.used < tokens.length) && left > 0 && graceLeft > 0) return wait();
  var target = hvliRevealField(form, found.widgets, tokens.slice(found.used));
  if (target.again && left > 0) return wait();
  // WHY: H5P opens a group 100 ms after `expand()`, and a field in a closed group cannot take focus.
  setTimeout(function () {
    var at = target.scopes.length - 1;
    while (at >= 0 && !hvliFocusIn(target.scopes[at])) at -= 1;
    if (at < 0) page.fallback().focus();
    if (at < 0 || at < target.scopes.length - 1 || !target.complete) page.notReached();
  }, 150);
}
