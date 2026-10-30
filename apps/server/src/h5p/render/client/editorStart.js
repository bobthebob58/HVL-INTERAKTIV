/**
 * editorStart — points H5P's editor at our editor page, starts it, and says whether it can save.
 *
 * Why: «Lagre» must never be a button that does nothing (UD-006). `H5PEditor.Editor` returns at once, but its
 *      `getContent` works only once H5P's editor iframe has loaded its scripts, the content types have arrived and the
 *      activity's form is built: before the iframe has loaded, it throws (`iframeWindow` is not set yet), which left
 *      «Lagrar …» on screen and «Lagre» disabled for good (found reproducing CI run 41075981429 on `main`). H5P's
 *      `Editor` relays its library selector's `editorload` (a content type starts loading) and `editorloaded` (its
 *      form is built) to this page's `H5P.externalDispatcher`, so the page follows those two events.
 * Spec: H5P-002, H5P-007, UD-006
 * Invariants:
 *   - `onReadiness(true)` comes only on `editorloaded`, and only when `getContent` has what it reads: the iframe's
 *     `H5PEditor`, the selector's form and that form's metadata form (a library without semantics has none);
 *     every `editorload` calls `onReadiness(false)`. A new activity is ready once its content type is chosen.
 *   - The listeners are added before the editor is made, so neither event can be missed.
 *   - The editor iframe always has an accessible name and, where frame storage is blocked, the page's stand-in.
 *   - The top-level `hvli*` functions touch only what they are given, the editor iframe and `window.H5P`.
 * Collaborators: ./editorPage.js (calls `hvliConfigureEditor` and `hvliStartEditor`; loaded after this file),
 *   ../editorPage.ts (loads it), apps/server/src/lti/pages/client/h5pStorageGuard.js (`hvliGuardFrameStorage`,
 *   Canvas only), H5P's h5peditor-editor.js and h5peditor-library-selector.js (the pinned editor, D-022).
 * Tests: apps/server/test/h5p/editorReadiness.browser.int.test.ts, apps/server/test/h5p/render/editorStartScript.test.ts,
 *   apps/server/e2e/appPlayEditor.e2e.test.ts, apps/server/e2e/ltiEditor.e2e.test.ts
 */
'use strict';
/* exported hvliConfigureEditor, hvliEditorCanSave, hvliStartEditor */

/**
 * Points H5P's editor namespace at this page's integration, as H5P's form-based h5peditor-init.js would.
 * @param ns - `window.H5PEditor`.
 * @param settings - `H5PIntegration.editor`.
 * @param contentId - The activity, or null for a new one.
 */
function hvliConfigureEditor(ns, settings, contentId) {
  ns.$ = window.H5P.jQuery;
  ns.basePath = settings.libraryUrl;
  ns.fileIcon = settings.fileIcon;
  ns.ajaxPath = settings.ajaxPath;
  ns.filesPath = settings.filesPath;
  ns.apiVersion = settings.apiVersion;
  ns.contentLanguage = settings.language;
  ns.copyrightSemantics = settings.copyrightSemantics;
  ns.metadataSemantics = settings.metadataSemantics;
  ns.assets = settings.assets;
  ns.baseUrl = '';
  ns.enableContentHub = false;
  if (contentId) ns.contentId = contentId;
  // WHY: H5P's h5peditor-init.js defines this next to its form-based `init`, which Lumi does not load; the editor
  // iframe copies it from this window. Same behaviour as H5P's own.
  ns.getAjaxUrl = function (action, parameters) {
    var url = settings.ajaxPath + action;
    var separator = url.indexOf('?') === -1 ? '?' : '&';
    Object.keys(parameters || {}).forEach(function (name) {
      url += separator + name + '=' + parameters[name];
      separator = '&';
    });
    return url;
  };
}

/**
 * Whether H5P's editor has everything its `getContent` reads, so a save can run.
 * @param editor - The `H5PEditor.Editor`, or undefined before it exists.
 * @returns True when a save can run now.
 */
function hvliEditorCanSave(editor) {
  // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5peditor-editor.js
  // `getContent` reads `iframeWindow.H5PEditor` and `selector.form.metadataForm` without checking them.
  var selector = editor && editor.selector;
  var form = selector && selector.form;
  return Boolean(editor && editor.iframeWindow && editor.iframeWindow.H5PEditor && form && form.metadataForm);
}

/**
 * Starts H5P's editor in place of `options.container` and reports whether it can save.
 * @param ns - `window.H5PEditor`, set up by {@link hvliConfigureEditor}.
 * @param options - `library` and `params` (both undefined for a new activity), `container`, `frameTitle` (the
 *   iframe's name until the activity has a title) and `onReadiness(canSave)`.
 * @returns The `H5PEditor.Editor`.
 */
function hvliStartEditor(ns, options) {
  var editor;
  // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5peditor-editor.js
  // relays the selector's `editorload` and `editorloaded` (h5peditor-library-selector.js `loadSemantics`) here.
  var dispatcher = window.H5P.externalDispatcher;
  dispatcher.on('editorload', () => options.onReadiness(false));
  dispatcher.on('editorloaded', () => options.onReadiness(hvliEditorCanSave(editor)));
  editor = new ns.Editor(options.library, options.params, options.container);
  // WHY: where frame storage is blocked, the iframe's H5P scripts need the page's stand-in (h5pStorageGuard.js).
  // They are fetched, so they run after this line.
  var frame = document.querySelector('iframe.h5p-editor-iframe');
  // A11Y: WCAG 4.1.2: H5P names its iframe after the activity's title, which a new activity does not have yet.
  if (frame && !frame.getAttribute('title')) frame.setAttribute('title', options.frameTitle);
  if (typeof window.hvliGuardFrameStorage === 'function' && frame)
    window.hvliGuardFrameStorage(frame.contentWindow);
  return editor;
}
