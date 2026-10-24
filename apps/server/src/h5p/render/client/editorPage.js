/**
 * editorPage — boots H5P's editor on our editor page, loads and saves the activity, and focuses a finding's field.
 *
 * Why: the page has no inline script (D-070); its own requests carry the ltik as Bearer in Canvas or the CSRF token in
 *      the portal (D-057, D-058); a refused save says why in the server's words (UD-013); a refused save of a
 *      published activity also lists the errors to fix with "Gå til feltet" (D-074), since the Check tab sees only
 *      the stored version; and "Gå til feltet" (PROD-003) posts `hvli:go-to-field` with a path for this page.
 * Spec: H5P-002, H5P-007, UD-006, UD-013, PROD-003
 * Invariants: settings come only from `#hvl-editor-config`; `hvli:content-saved` goes to, and `hvli:go-to-field` is
 *   taken from, the parent on our own origin only; server text is written as text, never as markup; the generic
 *   failure text is used only when the answer gives no reason (network error, 5xx, unreadable body); the top-level
 *   `hvli*` functions touch only what they are given.
 * Collaborators: ../editorPage.ts, ./editorFields.js (loaded first: following a finding's path),
 *   ../../../http/routes/contentRoutes.ts, ../../../http/h5pErrorResponse.ts, apps/web/src/messaging/frameMessages.ts.
 * Tests: apps/server/test/h5p/editorPage.browser.int.test.ts, apps/server/test/h5p/render/editorPageScript.test.ts,
 *   apps/server/test/h5p/editorGoToField.browser.int.test.ts, apps/server/test/h5p/editorBlockedSave.browser.int.test.ts
 */
'use strict';
/* global hvliGoToField -- from ./editorFields.js, loaded before this file */

/** The errors of a refused save of a published activity that no one has explained: what the author must fix. */
function hvliOpenErrors(body) {
  if (!body || body.errorCode !== 'hvl:published-save-blocked' || !Array.isArray(body.findings)) return [];
  return body.findings.filter((f) => f && f.severity === 'error' && !f.acknowledgement && f.message);
}

/** The status text for a refused save: the server's reason (this page's own for a blocked save), else the generic. */
function hvliSaveFailureText(status, body, messages) {
  var reason = status >= 400 && status < 500 && body && typeof body.errorCode === 'string' && body.message;
  if (!reason) return messages.failed;
  if (body.errorCode !== 'hvl:published-save-blocked') return String(body.message);
  var open = hvliOpenErrors(body).length;
  var count = open && messages.blockedErrors ? messages.blockedErrors.replace('{{count}}', open) : '';
  return [messages.blocked || body.message, count].filter(Boolean).join(' ');
}

(function startEditor() {
  var block = document.getElementById('hvl-editor-config');
  if (!block || !window.H5PEditor || !window.H5PIntegration) return;
  var config = JSON.parse(block.textContent || '{}');
  var ns = window.H5PEditor;
  var settings = window.H5PIntegration.editor;
  var saveButton = document.getElementById('hvl-editor-save');
  var status = document.getElementById('hvl-editor-status');
  var findingList = document.getElementById('hvl-editor-findings');
  var contentId = config.contentId;
  var editor;

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
    // A11Y: WCAG 4.1.2: H5P names its iframe after the activity's title, which a new activity does not have yet.
    if (frame && !frame.getAttribute('title')) frame.setAttribute('title', config.messages.editorFrameTitle);
    if (typeof window.hvliGuardFrameStorage === 'function' && frame)
      window.hvliGuardFrameStorage(frame.contentWindow);
    saveButton.disabled = false;
  }
  function send(content) {
    var body = JSON.stringify({ library: content.library, params: JSON.parse(content.params) });
    var url = contentId ? '/h5p/content/' + encodeURIComponent(contentId) : '/h5p/content';
    var method = contentId ? 'PUT' : 'POST';
    var init = { method: method, headers: headers(true), body: body, credentials: 'same-origin' };
    return fetch(url, init).then(function (response) {
      if (response.ok) return response.json();
      var fail = function (answer) {
        var error = new Error('save ' + response.status);
        error.statusText = hvliSaveFailureText(response.status, answer, config.messages);
        error.openErrors = hvliOpenErrors(answer);
        throw error;
      };
      return response.json().then(fail, fail.bind(null, null));
    });
  }

  function element(tag, text, attributes) {
    var made = document.createElement(tag);
    made.textContent = text;
    Object.keys(attributes || {}).forEach((name) => made.setAttribute(name, attributes[name]));
    return made;
  }
  // PROD-003: each error is named by an icon and a word, never by colour alone (UD-003), and describes its button.
  function showErrors(errors) {
    findingList.replaceChildren();
    findingList.parentElement.hidden = errors.length === 0;
    errors.forEach(function (finding, index) {
      var label = element('strong', config.messages.errorLabel + ':');
      label.prepend(element('span', '\u2717 ', { 'aria-hidden': 'true' }));
      var text = element('p', ' ' + finding.message, { id: 'hvl-editor-finding-' + index });
      text.prepend(label);
      var item = findingList.appendChild(element('li', ''));
      item.append(text);
      if (typeof finding.path !== 'string' || finding.path === '') return;
      var button = element('button', config.messages.goToField, {
        type: 'button',
        'aria-describedby': text.id,
      });
      button.addEventListener('click', () => goToField(finding.path));
      item.append(button);
    });
  }

  function save() {
    saveButton.disabled = true;
    showErrors([]);
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
            var saved = { type: 'hvli:content-saved', contentId: contentId };
            if (window.parent !== window) window.parent.postMessage(saved, location.origin);
          })
          .catch(function (error) {
            announce(error.statusText || config.messages.failed);
            showErrors(error.openErrors || []);
          })
          .then(done);
      },
      function () {
        announce(config.messages.failed);
        done();
      },
    );
  }

  // A11Y: WCAG 2.4.3: "Gå til feltet" focuses the field itself (./editorFields.js waits while H5P builds it), or
  // the closest part it can open, and then says so: focus is never dropped.
  function goToField(path) {
    var editorFrame = document.querySelector('iframe.h5p-editor-iframe');
    hvliGoToField(() => editor && editor.selector && editor.selector.form, path, {
      fallback: () => editorFrame || saveButton,
      notReached: () => announce(config.messages.fieldNotReached),
    });
  }

  window.addEventListener('message', function (event) {
    var data = event.data || {};
    // SECURITY: only the web app page that frames us, on our own origin, may move focus in the editor.
    if (event.origin !== location.origin || event.source !== window.parent) return;
    if (data.type === 'hvli:go-to-field' && typeof data.path === 'string' && data.path.length <= 1000)
      goToField(data.path);
  });
  saveButton.addEventListener('click', save);
  if (!contentId) return start(undefined, undefined);
  var paramsInit = { headers: headers(false), credentials: 'same-origin' };
  fetch('/h5p/params/' + encodeURIComponent(contentId), paramsInit)
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
