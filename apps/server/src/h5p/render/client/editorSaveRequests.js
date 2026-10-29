/**
 * editorSaveRequests — the editor page's own requests (load, save, save as a copy) and the texts of a refused one.
 *
 * Why: the page has no inline script (D-070); its own requests carry the ltik as Bearer in Canvas or the CSRF token in
 *      the portal (D-057, D-058); a refused save says why in the server's words (UD-013), and a refused save of a
 *      published activity lists the errors to fix (D-074). A structural save that would reset other people's
 *      progress is refused with 409 `hvl:learner-state-reset-needed`, which ./editorSaveChoice.js answers (D-093).
 * Spec: H5P-002, H5P-007, UD-013, PROD-003, PROD-013
 * Invariants:
 *   - The token goes only into a header of a same-origin request, never into a URL, a message or storage.
 *   - The generic failure text is used only when the answer gives no reason (network error, an undeliberate 5xx,
 *     unreadable body); a copy's own 500 `hvl:duplicate-failed` keeps its message (D-099).
 *   - A refusal carries its status and machine code, so the page branches on the code, never on the text.
 *   - The top-level `hvli*` functions touch only what they are given.
 * Collaborators: ./editorPage.js (calls them; loaded after this file), ./editorSaveChoice.js,
 *   ../../../http/routes/contentRoutes.ts (the routes), ../../../http/h5pErrorResponse.ts (the error shape).
 * Tests: apps/server/test/h5p/render/editorPageScript.test.ts, apps/server/test/h5p/render/editorSaveRequests.test.ts,
 *   apps/server/test/h5p/editorBlockedSave.browser.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/saveChoiceRoundTrip.browser.int.test.ts
 */
'use strict';
/* exported hvliOpenErrors, hvliSaveFailureText, hvliRequestHeaders, hvliSaveContent, hvliSaveAsCopy */

/** The machine code of the refusal that asks the author to choose (D-093). */
var HVLI_RESET_NEEDED = 'hvl:learner-state-reset-needed';
/** A copy's deliberate 5xx: nothing was saved, and the server says so in its own words. */
var HVLI_COPY_FAILED = 'hvl:duplicate-failed';

/** The errors of a refused save of a published activity that no one has explained: what the author must fix. */
function hvliOpenErrors(body) {
  if (!body || body.errorCode !== 'hvl:published-save-blocked' || !Array.isArray(body.findings)) return [];
  return body.findings.filter((f) => f && f.severity === 'error' && !f.acknowledgement && f.message);
}

/** The status text for a refused save: the server's reason (this page's own for a blocked save), else the generic. */
function hvliSaveFailureText(status, body, messages) {
  var coded = body && typeof body.errorCode === 'string' && body.message;
  var deliberate = coded && status === 500 && body.errorCode === HVLI_COPY_FAILED;
  var reason = (status >= 400 && status < 500 && coded) || deliberate;
  if (!reason) return messages.failed;
  if (body.errorCode !== 'hvl:published-save-blocked') return String(body.message);
  var open = hvliOpenErrors(body).length;
  var count = open && messages.blockedErrors ? messages.blockedErrors.replace('{{count}}', open) : '';
  return [messages.blocked || body.message, count].filter(Boolean).join(' ');
}

/** The headers of the page's own requests: JSON, and the page's token (the ltik as Bearer, or the CSRF token). */
function hvliRequestHeaders(token, json) {
  var result = { Accept: 'application/json' };
  if (json) result['Content-Type'] = 'application/json';
  if (token && token.name === 'ltik') result.Authorization = 'Bearer ' + token.value;
  if (token && token.name === 'csrf') result['X-CSRF-Token'] = token.value;
  return result;
}

/** Sends one JSON request; resolves with the answer, or rejects with its status, code, text and open errors. */
function hvliSendJson(url, method, payload, config) {
  var init = {
    method: method,
    headers: hvliRequestHeaders(config.token, true),
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  };
  return fetch(url, init).then(function (response) {
    if (response.ok) return response.json();
    var fail = function (answer) {
      var error = new Error('save ' + response.status);
      error.status = response.status;
      error.errorCode = answer && typeof answer.errorCode === 'string' ? answer.errorCode : undefined;
      error.resetNeeded = response.status === 409 && error.errorCode === HVLI_RESET_NEEDED;
      error.statusText = hvliSaveFailureText(response.status, answer, config.messages);
      error.openErrors = hvliOpenErrors(answer);
      throw error;
    };
    return response.json().then(fail, fail.bind(null, null));
  });
}

/**
 * Saves the editor's content: a new activity (POST) or the open one (PUT), with the author's answer to the save
 * choice (`confirmLearnerStateReset`, D-093) when there is one.
 */
function hvliSaveContent(content, contentId, config, confirmLearnerStateReset) {
  var body = { library: content.library, params: JSON.parse(content.params) };
  if (confirmLearnerStateReset === true) body.confirmLearnerStateReset = true;
  if (!contentId) return hvliSendJson('/h5p/content', 'POST', body, config);
  return hvliSendJson('/h5p/content/' + encodeURIComponent(contentId), 'PUT', body, config);
}

/** «Lagre som ny versjon» (portal only): saves the edit as a new private draft linked to the activity. */
function hvliSaveAsCopy(content, contentId, config) {
  var url = '/h5p/content/' + encodeURIComponent(contentId) + '/copy';
  // WHY: H5P's editor gives `{ params, metadata }` as a JSON string; the copy route takes that object as it is.
  return hvliSendJson(url, 'POST', JSON.parse(content.params), config);
}
