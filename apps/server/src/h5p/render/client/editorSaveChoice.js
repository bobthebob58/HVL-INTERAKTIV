/**
 * editorSaveChoice — the save choice of a structural edit (PROD-013): a native modal <dialog> in the editor page that
 * asks the author to cancel, to reset other people's saved progress and save, or (in the portal) to save the edit as
 * a new version.
 *
 * Why: a structural edit resets the progress learners have saved, so the server refuses it with 409
 *      `hvl:learner-state-reset-needed` until the author has chosen (D-093). The editor page is always framed (the
 *      portal's Rediger tab and Canvas), where a native modal dialog is modal only inside the frame, so Tab and
 *      Shift+Tab are kept in the dialog, and focus is taken back only when the H5P editor's own iframe takes it
 *      (probe P7, D-093 amendment). Canvas offers reset or cancel, with a pointer to the portal (D-098).
 * Spec: PROD-013, UD-006, UD-004, UD-030
 * Invariants:
 *   - Texts come from the page's config block (`saveChoice`, saveChoiceMessages.ts) and are written as text, never
 *     as markup; the dialog is named by its heading and described by its explanation.
 *   - Focus starts on «Avbryt»; Escape cancels; any close without a choice counts as cancel.
 *   - The promise resolves in the dialog's `close` handler, after the dialog has been removed; the caller re-enables
 *     «Lagre», focuses it and only then announces the outcome (the status region is inert while the dialog is open).
 *   - Only a focus move into an IFRAME of this page is undone; focus that leaves for the page around ours is left
 *     alone, so keys typed there never land in the dialog.
 *   - `hvli:modal-open` and `hvli:modal-closed` go to the parent on our own origin only, so the portal's activity
 *     page can make its own controls inert, and after a copy `hvli:content-copied` so it opens the copy's editor
 *     (apps/web/src/messaging/frameMessages.ts).
 *   - Reset resends exactly the refused content, with `confirmLearnerStateReset: true`; Canvas never sends a copy.
 *   - No storage, no cookies; the functions touch only the dialog they build and the window's own listeners.
 * Collaborators: ./editorPage.js (opens it on the 409), ./editorSaveRequests.js,
 *   ../../../http/pages/assets/editorSaveChoice.css (the look), ../editorPage.ts (loads both),
 *   ../../../learningDesign/safeEditing/saveChoiceMessages.ts (the texts).
 * Tests: apps/server/test/h5p/render/editorSaveChoiceScript.test.ts,
 *   apps/server/test/learningDesign/safeEditing/saveChoiceRoundTrip.browser.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/saveChoiceKeyboard.browser.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/saveChoiceCanvas.browser.int.test.ts,
 *   apps/server/a11y/axeSaveChoice.a11y.test.ts
 */
'use strict';
/* exported hvliSaveChoice, hvliAnswerResetNeeded */
/* global hvliSaveContent, hvliSaveAsCopy -- from ./editorSaveRequests.js, loaded before this file */

/** The messages the dialog posts to the page that frames the editor. */
var HVLI_MODAL_OPEN = 'hvli:modal-open';
var HVLI_MODAL_CLOSED = 'hvli:modal-closed';

/** Makes an element with text (never markup) and attributes. */
function hvliChoiceElement(tag, text, attributes) {
  var made = document.createElement(tag);
  if (text) made.textContent = text;
  Object.keys(attributes || {}).forEach((name) => made.setAttribute(name, attributes[name]));
  return made;
}

/** The choices of this page, last «Avbryt», as the web app's dialogs put the secondary action last. */
function hvliChoiceList(texts, inCanvas) {
  var choices = [{ value: 'reset', label: texts.reset }];
  if (!inCanvas && texts.saveAsCopy) choices.push({ value: 'copy', label: texts.saveAsCopy });
  return choices.concat([{ value: 'cancel', label: texts.cancel }]);
}

/** Builds the dialog: a heading, the explanation, the portal's hint or Canvas's pointer, and the buttons. */
function hvliBuildChoice(texts, inCanvas) {
  var note = inCanvas ? texts.canvasPointer : texts.saveAsCopyHint;
  var dialog = hvliChoiceElement('dialog', '', {
    id: 'hvl-save-choice',
    class: 'hvl-save-choice',
    'aria-labelledby': 'hvl-save-choice-title',
    'aria-describedby':
      inCanvas && note ? 'hvl-save-choice-text hvl-save-choice-note' : 'hvl-save-choice-text',
  });
  // WHY: `method="dialog"` closes the dialog with the pressed button's value, without a navigation that
  // `form-action 'self'` would govern (probe P7).
  var form = hvliChoiceElement('form', '', { method: 'dialog' });
  form.append(hvliChoiceElement('h2', texts.title, { id: 'hvl-save-choice-title' }));
  form.append(hvliChoiceElement('p', texts.body, { id: 'hvl-save-choice-text' }));
  if (note) form.append(hvliChoiceElement('p', note, { id: 'hvl-save-choice-note' }));
  var row = form.appendChild(hvliChoiceElement('p', '', { class: 'hvl-save-choice-actions' }));
  var buttons = hvliChoiceList(texts, inCanvas).map(function (choice) {
    var attributes = { value: choice.value, id: 'hvl-save-choice-' + choice.value };
    if (choice.value === 'cancel') Object.assign(attributes, { autofocus: '', class: 'hvl-secondary' });
    // A11Y: the hint says what «Lagre som ny versjon» does, read with the button (WCAG 2.4.6, 3.3.2).
    if (choice.value === 'copy' && note) attributes['aria-describedby'] = 'hvl-save-choice-note';
    return row.appendChild(hvliChoiceElement('button', choice.label, attributes));
  });
  dialog.append(form);
  return { dialog: dialog, buttons: buttons };
}

/**
 * A11Y: WCAG 2.1.2, 2.4.3: Tab and Shift+Tab wrap inside the dialog; natively they leave the framed page (P7).
 * @returns The listener's remover.
 */
function hvliWrapTab(dialog, buttons) {
  var wrap = function (event) {
    if (event.key !== 'Tab' || !dialog.open) return;
    var at = buttons.indexOf(document.activeElement);
    // WHY: a click on the dialog's text focuses the dialog itself (Chromium), and Shift+Tab from there would leave.
    var to = at === -1 ? (event.shiftKey ? buttons.length - 1 : 0) : undefined;
    if (event.shiftKey && at === 0) to = buttons.length - 1;
    if (!event.shiftKey && at === buttons.length - 1) to = 0;
    if (to === undefined) return;
    event.preventDefault();
    buttons[to].focus();
  };
  document.addEventListener('keydown', wrap, true);
  return () => document.removeEventListener('keydown', wrap, true);
}

/** Takes focus back to `home` when a script in the inert H5P editor iframe took it; returns the listener's remover. */
function hvliGuardFrameFocus(dialog, home) {
  // WHY: Chromium lets a script inside the inert editor iframe focus its own fields, and Escape then goes to that
  // frame. Focus that left for the page around ours (Rediger tab, Canvas) is that page's (probe P7).
  var guard = function () {
    setTimeout(function () {
      var active = document.activeElement;
      if (!dialog.open || !active || active.tagName !== 'IFRAME') return;
      window.focus();
      home.focus();
    }, 0);
  };
  window.addEventListener('blur', guard);
  return () => window.removeEventListener('blur', guard);
}

/** Tells the page that frames the editor (our own origin only), e.g. that the dialog opened or closed. */
function hvliTellFramer(message) {
  // SECURITY: the target origin is ours, so a foreign page around ours (Canvas) never receives it.
  if (window.parent !== window) window.parent.postMessage(message, location.origin);
}

/**
 * Shows the save choice and resolves with `reset`, `copy` (portal only) or `cancel` once it has closed.
 * @param texts - The dialog's texts from the page's config (`saveChoice`).
 * @param inCanvas - True in Canvas (`/lti/edit`): no copy, the pointer to the portal instead.
 * @returns A promise of the choice; the dialog is gone from the page when it resolves.
 */
function hvliSaveChoice(texts, inCanvas) {
  var made = hvliBuildChoice(texts, inCanvas);
  var dialog = made.dialog;
  var cancel = made.buttons[made.buttons.length - 1];
  var unwrap = hvliWrapTab(dialog, made.buttons);
  return new Promise(function (resolve) {
    var unguard = function () {};
    dialog.addEventListener('close', function () {
      var value = dialog.returnValue;
      unwrap();
      unguard();
      dialog.remove();
      hvliTellFramer({ type: HVLI_MODAL_CLOSED });
      resolve(value === 'reset' || (value === 'copy' && !inCanvas) ? value : 'cancel');
    });
    document.body.append(dialog);
    hvliTellFramer({ type: HVLI_MODAL_OPEN });
    dialog.showModal();
    // WHY: autofocus applies in showModal; focusing again makes sure even when a frame held focus before.
    cancel.focus();
    unguard = hvliGuardFrameFocus(dialog, cancel);
  });
}

/**
 * Answers a 409 `hvl:learner-state-reset-needed`: asks for the choice and carries it out. «Nullstill framgangen og
 * lagre» resends the same content with `confirmLearnerStateReset: true`; «Lagre som ny versjon» (portal only) saves
 * it as a new private draft and asks the framing page to open that draft's editor (`hvli:content-copied`); «Avbryt»
 * saves nothing. Each way ends with `page.settle(text, errors)`.
 * @param content - The editor's content of the refused save (`editor.getContent`).
 * @param page - `{ config, contentId, saved(result), settle(text, errors) }` of ./editorPage.js.
 * @returns A promise that resolves once the choice has been carried out and settled.
 */
function hvliAnswerResetNeeded(content, page) {
  var config = page.config;
  var texts = config.saveChoice;
  var inCanvas = config.inCanvas === true;
  var failed = (error) => page.settle(error.statusText || config.messages.failed, error.openErrors);
  var chosen = function (choice) {
    if (choice === 'reset') {
      return hvliSaveContent(content, page.contentId, config, true)
        .then(function (result) {
          page.saved(result);
          page.settle(texts.resetAndSaved);
        })
        .catch(failed);
    }
    // SECURITY: Canvas never asks for a copy (D-098); the copy route refuses an ltik as well.
    if (choice !== 'copy' || inCanvas) return page.settle(texts.cancelled);
    return hvliSaveAsCopy(content, page.contentId, config)
      .then(function (result) {
        page.settle(texts.savedAsCopy);
        hvliTellFramer({ type: 'hvli:content-copied', contentId: result.contentId });
      })
      .catch(failed);
  };
  return hvliSaveChoice(texts, inCanvas).then(chosen, () => page.settle(config.messages.failed));
}
