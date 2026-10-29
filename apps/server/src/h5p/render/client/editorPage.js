/**
 * editorPage — boots H5P's editor on our editor page, loads and saves the activity, answers a structural save with
 * the save choice, and focuses a finding's field.
 *
 * Why: the page has no inline script (D-070); a refused save says why in the server's words (UD-013) and, for a
 *      published activity, lists the errors to fix with "Gå til feltet" (D-074), since the Check tab sees only the
 *      stored version; a structural save while others have saved progress is refused with 409
 *      `hvl:learner-state-reset-needed` and answered by the author's choice (PROD-013, D-093); and "Gå til feltet"
 *      (PROD-003) posts `hvli:go-to-field` with a path for this page.
 * Spec: H5P-002, H5P-007, UD-006, UD-013, PROD-003, PROD-013
 * Invariants: settings come only from `#hvl-editor-config`; `hvli:content-saved` and `hvli:content-copied` go to, and
 *   `hvli:go-to-field` is taken from, the parent on our own origin only; server text is written as text, never as
 *   markup; the save choice replaces the failure text of its 409, and after it «Lagre» is enabled and focused before
 *   the outcome is announced; «Avbryt» saves nothing; Canvas never sends a copy request (D-098).
 * Collaborators: ../editorPage.ts, ./editorFields.js and ./editorFieldReveal.js (a finding's path),
 *   ./editorSaveRequests.js (the requests) and ./editorSaveChoice.js (the dialog), all loaded first;
 *   ../../../http/routes/contentRoutes.ts, apps/web/src/messaging/frameMessages.ts.
 * Tests: apps/server/test/h5p/editorPage.browser.int.test.ts, apps/server/test/h5p/render/editorPageScript.test.ts,
 *   apps/server/test/h5p/editorGoToField.browser.int.test.ts, apps/server/test/h5p/editorBlockedSave.browser.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/saveChoiceRoundTrip.browser.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/saveChoiceCanvas.browser.int.test.ts
 */
'use strict';
/* global hvliGoToField -- from ./editorFields.js, loaded before this file */
/* global hvliRequestHeaders, hvliSaveContent -- from ./editorSaveRequests.js, loaded before this file */
/* global hvliAnswerResetNeeded -- from ./editorSaveChoice.js, loaded before this file */

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
      label.prepend(element('span', '✗ ', { 'aria-hidden': 'true' }));
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

  function saved(result) {
    contentId = result.contentId;
    var message = { type: 'hvli:content-saved', contentId: contentId };
    if (window.parent !== window) window.parent.postMessage(message, location.origin);
  }
  // A11Y: WCAG 2.4.3, 4.1.3: after the save choice, «Lagre» is enabled and focused first, then the outcome is
  // announced in the status region, which the open dialog kept inert (D-093).
  function settle(text, errors) {
    saveButton.disabled = false;
    saveButton.focus();
    announce(text);
    showErrors(errors || []);
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
        hvliSaveContent(content, contentId, config)
          .then(function (result) {
            saved(result);
            announce(config.messages.saved);
            done();
          })
          .catch(function (error) {
            // PROD-013: the dialog answers this 409 instead of the failure text (D-093).
            if (error.resetNeeded && contentId && config.saveChoice) {
              // WHY: "saving" is not true while the author chooses; the outcome replaces the empty text afterwards.
              announce('');
              var page = { config: config, contentId: contentId, saved: saved, settle: settle };
              return hvliAnswerResetNeeded(content, page);
            }
            announce(error.statusText || config.messages.failed);
            showErrors(error.openErrors || []);
            done();
          });
      },
      function () {
        announce(config.messages.failed);
        done();
      },
    );
  }

  // A11Y: WCAG 2.4.3, 4.1.3: focuses the field (./editorFields.js waits while H5P builds it), or the closest part and
  // says so; an earlier "not reached" is emptied first (a refused save's reason stays), so a new one is announced.
  function goToField(path) {
    var editorFrame = document.querySelector('iframe.h5p-editor-iframe');
    var notReached = [config.messages.fieldNotReached, config.messages.titleNotReached];
    if (notReached.includes(status.textContent)) announce('');
    hvliGoToField(() => editor && editor.selector && editor.selector.form, path, {
      fallback: () => editorFrame || saveButton,
      notReached: () => announce(config.messages.fieldNotReached),
      titleNotReached: () => announce(config.messages.titleNotReached),
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
  var paramsInit = { headers: hvliRequestHeaders(config.token, false), credentials: 'same-origin' };
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
