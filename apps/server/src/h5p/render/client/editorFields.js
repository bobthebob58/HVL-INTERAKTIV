/**
 * editorFields — follows a finding's path through H5P's editor widgets, opens what hides the field and focuses it.
 *
 * Why: "Gå til feltet" (PROD-003, UD-021) takes the author from a finding to the field it names. H5P builds the
 *      form, lists and sub-content forms asynchronously, the last after loading each library, so the field may not
 *      exist yet when the message arrives; the first click is often what loads the editor tab at all.
 * Spec: PROD-003, UD-006, UD-021
 * Invariants:
 *   - It waits only while H5P is still building: no form yet, or the deepest widget found is a sub-content widget
 *     whose library is still loading (`children` undefined). Once nothing is loading, a path that leads no further
 *     (metadata, custom editors such as CoursePresentation) gets one second's grace, then the deepest part found,
 *     or `fallback()`, takes focus. It never waits longer than twenty seconds.
 *   - The functions touch only the widgets and elements they are given.
 * Collaborators: ./editorPage.js (calls `hvliGoToField`), ../editorPage.ts (loads this file before it).
 * Tests: apps/server/test/h5p/render/editorFieldsScript.test.ts, apps/server/test/h5p/render/editorPageScript.test.ts,
 *   apps/server/test/h5p/editorGoToField.browser.int.test.ts
 */
'use strict';
/* exported hvliGoToField */

var HVLI_FOCUSABLE = 'input:not([type=hidden]),textarea,select,button,[contenteditable="true"],[tabindex]';

/** Splits a finding path into names and list positions; `params` names no widget (sub-content shows them itself). */
function hvliFieldTokens(path) {
  var cleaned = String(path).replace(/\.params(?=[.[]|$)/g, '');
  return (cleaned.match(/\[\d+\]|[^.[\]]+/g) || []).map((p) => (p[0] === '[' ? Number(p.slice(1, -1)) : p));
}

/** Follows the tokens through H5P editor widgets (fields, lists, sub-content); returns those found, outermost first. */
function hvliFieldChain(form, tokens) {
  var chain = [];
  var node = form;
  tokens.forEach(function (token) {
    if (!node) return;
    var children = node.children || [];
    if (!node.children && node.forEachChild) node.forEachChild((child) => void children.push(child));
    node = children.filter((c, i) => i === token || Boolean(c && c.field && c.field.name === token))[0];
    if (node) chain.push(node);
  });
  return chain;
}

/** Opens the groups and tabs around the chain's field, returns its control; a wrapper (showWhen) is found by class. */
function hvliRevealField(chain) {
  var scope = null;
  chain.forEach(function (widget) {
    if (typeof widget.expand === 'function') widget.expand();
    var own = (widget.$input || widget.$item || widget.$group || widget.$myField || [])[0];
    var named = scope && widget.field ? scope.querySelector('.field-name-' + widget.field.name) : null;
    scope = own || named || scope;
  });
  var control = scope && (scope.matches(HVLI_FOCUSABLE) ? scope : scope.querySelector(HVLI_FOCUSABLE));
  var form = control && control.closest('.h5p-vtab-form');
  while (form) {
    var tabs = form.closest('.h5p-vtab-wrapper').querySelectorAll(':scope > .h5p-vtabs .h5p-vtab-li');
    var tab = tabs[Array.prototype.indexOf.call(form.parentElement.children, form)];
    if (tab) control.ownerDocument.defaultView.H5P.jQuery(tab).trigger('open');
    form = form.parentElement.closest('.h5p-vtab-form');
  }
  return control || undefined;
}

/** True while H5P is still building the field: no form yet, or the deepest widget is a library still loading. */
function hvliStillBuilding(form, chain) {
  var last = chain.length > 0 ? chain[chain.length - 1] : form;
  if (!last) return true;
  return (
    typeof last.currentLibrary === 'string' && last.currentLibrary !== '-' && last.children === undefined
  );
}

var HVLI_FIELD_STEP_MS = 250;
var HVLI_FIELD_MAX_TRIES = 80;
var HVLI_FIELD_GRACE_TRIES = 5;

/** Follows `path` in the form `formOf()` returns, waiting while H5P builds it, then focuses the field or `fallback()`. */
function hvliGoToField(formOf, path, fallback, tries, grace) {
  var form = formOf();
  var tokens = hvliFieldTokens(path);
  var chain = form ? hvliFieldChain(form, tokens) : [];
  var left = tries === undefined ? HVLI_FIELD_MAX_TRIES : tries;
  var graceLeft = hvliStillBuilding(form, chain)
    ? HVLI_FIELD_GRACE_TRIES
    : (grace === undefined ? HVLI_FIELD_GRACE_TRIES : grace) - 1;
  if (chain.length < tokens.length && left > 0 && graceLeft > 0)
    return setTimeout(hvliGoToField, HVLI_FIELD_STEP_MS, formOf, path, fallback, left - 1, graceLeft);
  var control = hvliRevealField(chain);
  // WHY: H5P opens a group 100 ms after `expand()`, and a field in a closed group cannot take focus.
  setTimeout(() => (control || fallback()).focus(), 150);
}
