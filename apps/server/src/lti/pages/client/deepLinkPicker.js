/**
 * deepLinkPicker — the script of the Deep Linking picker: keeps the ltik in memory, sends the author's choice to the
 * server with it, and posts the signed answer back to Canvas.
 *
 * Why: LTI-005 ends with a form post of the signed JWT to `deep_link_return_url`. The ltik arrives in the address
 *      bar (LTI-003 step 1); this script takes it into a variable and removes it from the URL at once (step 2), then
 *      uses it only as `Authorization: Bearer` (step 3), so it never travels in a cookie, a URL or storage.
 * Spec: LTI-005, LTI-003, PROD-005
 * Invariants:
 *   - The ltik lives in this function's closure only (ESLint forbids storage APIs and cookies in this folder).
 *   - The answer is posted only to an http(s) URL; the server already checked it (D-061), this is a second check.
 *   - Status and errors are written as text into live regions (`role="status"`, `role="alert"`); texts come from
 *     the page's `data-msg-*` attributes, which the server filled from the locale files.
 * Collaborators: ../deepLinkPickerPage.ts (markup and data attributes), ../../deepLinking/deepLinkRoutes.ts.
 * Tests: apps/server/test/lti/deepLinking/deepLinking.int.test.ts, apps/server/e2e/deepLinking.e2e.test.ts
 */
(function deepLinkPicker() {
  'use strict';
  var url = new URL(window.location.href);
  var ltik = url.searchParams.get('ltik');
  if (url.searchParams.has('ltik')) {
    url.searchParams.delete('ltik');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
  var form = document.getElementById('deep-link-form');
  if (!form || !ltik) return;
  var data = document.body.dataset;
  var status = document.getElementById('deep-link-status');
  var problem = document.getElementById('deep-link-error');
  var button = form.querySelector('button[type="submit"]');

  function say(statusText, problemText) {
    status.textContent = statusText;
    problem.textContent = problemText;
  }

  function postToPlatform(returnUrl, jwt) {
    var answer = document.createElement('form');
    answer.method = 'post';
    answer.action = returnUrl;
    var field = document.createElement('input');
    field.type = 'hidden';
    field.name = 'JWT';
    field.value = jwt;
    answer.appendChild(field);
    document.body.appendChild(answer);
    answer.submit();
  }

  function failed() {
    button.disabled = false;
    say('', data.msgFailed);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var inputs = form.querySelectorAll('input[name="contentId"]:checked');
    var chosen = Array.prototype.map.call(inputs, function (input) {
      return input.value;
    });
    if (chosen.length === 0) {
      say('', data.msgNone);
      return;
    }
    button.disabled = true;
    say(data.msgSending, '');
    fetch(data.responseUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + ltik,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ contentIds: chosen }),
      credentials: 'omit',
      cache: 'no-store',
    })
      .then(function (response) {
        if (!response.ok) throw new Error('refused');
        return response.json();
      })
      .then(function (answer) {
        // SECURITY: never post the signed answer to a `javascript:` or `data:` URL, whatever the server said.
        if (typeof answer.jwt !== 'string' || !/^https?:\/\//i.test(String(answer.returnUrl))) {
          throw new Error('malformed');
        }
        postToPlatform(answer.returnUrl, answer.jwt);
      })
      .catch(failed);
  });
})();
