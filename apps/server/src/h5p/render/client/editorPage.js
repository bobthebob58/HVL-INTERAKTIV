/**
 * editorPage — starts H5P's editor on our editor page, loads the activity's parameters and saves through the
 * content API.
 *
 * Why: the page has no inline script (D-070), so the start-up code Lumi's template had inline lives here. The
 *      page's own requests carry the ltik as `Authorization: Bearer` in a Canvas iframe, or the session cookie
 *      with the CSRF token in the portal (D-057, D-058); H5P's own requests carry them in their URLs.
 * Spec: H5P-002, H5P-007, UD-006
 * Invariants:
 *   - Reads its settings only from the inert `#hvl-editor-config` block; never from the URL.
 *   - The save button is enabled once the editor exists, and is disabled while a save is running.
 *   - Results are announced in the polite status region; a saved activity is reported to the parent frame on our
 *     own origin only (`hvli:content-saved`).
 * Collaborators: ../editorPage.ts, ../../../http/routes/contentRoutes.ts (`/h5p/params`, `/h5p/content`).
 * Tests: apps/server/test/h5p/editorPage.browser.int.test.ts
 */
(function startEditor() {
  'use strict';
  var block = document.getElementById('hvl-editor-config');
  if (!block || !window.H5PEditor || !window.H5PIntegration) return;
  var config = JSON.parse(block.textContent || '{}');
  var ns = window.H5PEditor;
  var $ = window.H5P.jQuery;
  var settings = window.H5PIntegration.editor;
  var saveButton = document.getElementById('hvl-editor-save');
  var status = document.getElementById('hvl-editor-status');
  var contentId = config.contentId;
  var editor;

  ns.$ = $;
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

  function headers(json) {
    var result = { Accept: 'application/json' };
    if (json) result['Content-Type'] = 'application/json';
    if (config.token && config.token.name === 'ltik') result.Authorization = 'Bearer ' + config.token.value;
    if (config.token && config.token.name === 'csrf') result['X-CSRF-Token'] = config.token.value;
    return result;
  }

  function announce(text) {
    status.textContent = text;
  }

  function start(library, params) {
    editor = new ns.Editor(library, params, document.querySelector('.h5p-editor'));
    // WHY: where frame storage is blocked, the iframe's H5P scripts need the page's stand-in (h5pStorageGuard.js).
    // They are fetched, so they run after this line.
    var frame = document.querySelector('iframe.h5p-editor-iframe');
    if (typeof window.hvliGuardFrameStorage === 'function' && frame)
      window.hvliGuardFrameStorage(frame.contentWindow);
    saveButton.disabled = false;
  }

  function send(content) {
    var body = JSON.stringify({ library: content.library, params: JSON.parse(content.params) });
    var url = contentId ? '/h5p/content/' + encodeURIComponent(contentId) : '/h5p/content';
    return fetch(url, {
      method: contentId ? 'PUT' : 'POST',
      headers: headers(true),
      body: body,
      credentials: 'same-origin',
    }).then(function (response) {
      if (!response.ok) throw new Error('save ' + response.status);
      return response.json();
    });
  }

  function save() {
    saveButton.disabled = true;
    announce(config.messages.saving);
    var done = function () {
      saveButton.disabled = false;
    };
    editor.getContent(
      function (content) {
        send(content)
          .then(function (result) {
            contentId = result.contentId;
            announce(config.messages.saved);
            if (window.parent !== window) {
              window.parent.postMessage(
                { type: 'hvli:content-saved', contentId: contentId },
                location.origin,
              );
            }
          })
          .catch(function () {
            announce(config.messages.failed);
          })
          .then(done);
      },
      function () {
        announce(config.messages.failed);
        done();
      },
    );
  }

  saveButton.addEventListener('click', save);
  if (!contentId) return start(undefined, undefined);
  fetch('/h5p/params/' + encodeURIComponent(contentId), {
    headers: headers(false),
    credentials: 'same-origin',
  })
    .then(function (response) {
      if (!response.ok) throw new Error('params ' + response.status);
      return response.json();
    })
    .then(function (result) {
      start(result.library, JSON.stringify(result.params));
    })
    .catch(function () {
      announce(config.messages.failed);
    });
})();
