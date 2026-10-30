/**
 * editorFields — follows a finding's path through H5P's editor widgets, waits while H5P builds them, has
 * ./editorFieldReveal.js open what hides the field, and focuses it.
 *
 * Why: "Gå til feltet" (PROD-003, UD-021) takes the author from a finding to the field it names. H5P builds forms,
 *      lists and sub-content forms asynchronously (each after its library loads, often only once a click opens the
 *      tab), so the field may not exist yet; custom editors keep fields in their own places (UPSTREAM notes below).
 * Spec: PROD-003, UD-006, UD-021
 * Invariants:
 *   - It waits only while H5P is still building (no form yet, the deepest widget's library loading, a title's
 *     metadata form not made yet, no IV toolbar yet, a form it closed still sliding out, a request of
 *     BranchingScenario's editor unanswered), at most 20 s;
 *     once nothing loads, a path that leads no further (metadata, CoursePresentation's slides) gets one second.
 *   - Focus goes to a shown control that takes focus: the field's own (CKEditor's editable once it stands in for
 *     an Html field; a list's wrapper), else the closest part's found along the path, else `page.fallback()`;
 *     whenever it is not the field's own (the whole form never is), `page.notReached()` is called.
 *   - A path that ends in `metadata.title` (the activity's, or the sub-content's the path leads to) focuses that title
 *     (./editorFieldReveal.js `hvliRevealTitle`); a title that does not take focus yet is tried again within that
 *     second; when the editor shows no title for it, focus goes to the closest part and `page.titleNotReached()`
 *     says why, never silently.
 *   - A guided tour that shows only after the field was opened, and so keeps it inert, is pressed and the path is
 *     followed again (within the same 20 s).
 *   - The functions touch only the widgets and elements they are given.
 *   - Each UPSTREAM note links the pinned source of the editor code it relies on; no issue is filed, since it records
 *     how that code works, not a bug (D-080 amendment of 2026-10-24, V2D-5). A note goes when a pinned version
 *     changes that behaviour, which the browser tests named below then catch.
 * Collaborators: ./editorFieldReveal.js (loaded before this file), ./editorPage.js (calls `hvliGoToField`),
 *   ../editorPage.ts (loads the three in that order).
 * Tests: apps/server/test/h5p/render/editorFieldsScript.test.ts, apps/server/test/h5p/render/editorFieldChain.test.ts,
 *   apps/server/test/h5p/editorGoToField.browser.int.test.ts, apps/server/test/h5p/editorGoToFieldEarly.browser.int.test.ts,
 *   apps/server/test/h5p/editorBlockedSave.browser.int.test.ts
 */
'use strict';
/* exported hvliGoToField */
/* global hvliRevealField, hvliOpenAround, hvliRevealTitle -- from ./editorFieldReveal.js, loaded before this file */

var HVLI_FOCUSABLE =
  'input:not([type=hidden]):not(:disabled),textarea:not(:disabled),select:not(:disabled),' +
  'button:not(:disabled),[contenteditable="true"],[tabindex]';
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

/** True while H5P is still building the field: no form, a library or BranchingScenario request loading, no IV toolbar. */
function hvliStillBuilding(form, chain) {
  var last = chain.length > 0 ? chain[chain.length - 1] : form;
  if (!last) return true;
  if (chain.slice(0, -1).some((w) => w.hvliInteractionsOf && !w.hvliInteractionsOf.dnb)) return true;
  // UPSTREAM: https://github.com/h5p/h5p-editor-branching-scenario/blob/8fcd92d0a5a5f6b855d9d03ce4d19ab31baa4b99/src/scripts/helpers/UserStorage.js
  // BranchingScenario asks for its tour flags by H5P.getUserData (jQuery ajax) and shows a tour once answered.
  var view = form.$form && form.$form[0].ownerDocument.defaultView;
  if (view?.document.querySelector('.bswrapper') && view.H5P.jQuery.active > 0) return true;
  var library = last.currentLibrary;
  return typeof library === 'string' && library !== '-' && last.children === undefined;
}

/** True when the rest of a path names a metadata title (`metadata.title`), which H5P keeps outside the fields. */
function hvliNamesTitle(rest) {
  return rest.length === 2 && rest[0] === 'metadata' && rest[1] === 'title';
}

/** True while the metadata form holding a title is not made yet: H5P makes a sub-content's once its library loads. */
function hvliTitleLoading(owner, form) {
  // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5peditor-library.js
  // `metadataForm` is unset until `loadLibrary`'s callback, and `null` there when the library turns metadata off.
  return (owner === form || typeof owner.loadLibrary === 'function') && owner.metadataForm === undefined;
}

/** Follows `path` in the form `formOf()` gives, waiting while H5P builds it; focuses the field, or the closest part. */
function hvliGoToField(formOf, path, page, tries, grace) {
  var form = formOf();
  var tokens = hvliFieldTokens(path);
  var found = form ? hvliFieldChain(form, tokens) : { widgets: [], used: 0 };
  var left = tries ?? HVLI_FIELD_WAIT.maxTries;
  var title = form && hvliNamesTitle(tokens.slice(found.used));
  var owner = found.widgets.length > 0 ? found.widgets.at(-1) : form;
  var building = hvliStillBuilding(form, found.widgets) || Boolean(title && hvliTitleLoading(owner, form));
  var graceLeft = building ? HVLI_FIELD_WAIT.graceTries : (grace ?? HVLI_FIELD_WAIT.graceTries) - 1;
  var wait = () => setTimeout(hvliGoToField, HVLI_FIELD_WAIT.stepMs, formOf, path, page, left - 1, graceLeft);
  if ((building || (found.used < tokens.length && !title)) && left > 0 && graceLeft > 0) return wait();
  var target = hvliRevealField(form, found.widgets, title ? [] : tokens.slice(found.used));
  if (target.again && left > 0) return wait();
  // WHY: H5P opens a group 100 ms after `expand()`, and a field in a closed group cannot take focus.
  setTimeout(function () {
    var titled = title ? hvliRevealTitle(owner) : '';
    if (titled === 'focused') return;
    // WHY: on a busy machine H5P may not show the title yet when the timer fires; the path is followed again first.
    if (titled === 'missed' && left > 0 && graceLeft > 0) return wait();
    var at = target.scopes.length - 1;
    while (at >= 0 && !hvliFocusIn(target.scopes[at])) at -= 1;
    if (titled === 'none') {
      if (at < 0) page.fallback().focus();
      return page.titleNotReached();
    }
    // WHY: a tour that showed after the reveal keeps the field inert; once it is pressed, the path is followed again.
    if (at < target.scopes.length - 1 && left > 0 && hvliOpenAround(target.scopes.at(-1))) return wait();
    if (at < 0) page.fallback().focus();
    var partial = at < 0 || at < target.scopes.length - 1 || !target.complete;
    if (titled === 'missed' || partial) page.notReached();
  }, 150);
}
