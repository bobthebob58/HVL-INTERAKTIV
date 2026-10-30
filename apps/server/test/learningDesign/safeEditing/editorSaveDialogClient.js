/**
 * editorSaveDialogClient — probe P7's stand-in for the boot script `editorSaveChoice.js` (D-093): builds the save
 * choice as a native modal <dialog> in the editor page's top document and records what the browser does with it.
 *
 * Why: the probe must show that the dialog works under the editor page's strict policy (D-070), so its code arrives
 *      the way a boot script does, as a same-origin file under `script-src 'self'`, and never through an inline
 *      script or DevTools evaluation (which the policy does not govern). The options switch on the remedies the
 *      probe found necessary, so the test can show the native behaviour and the remedy side by side.
 * Spec: PROD-013, UD-006, UD-004
 * Invariants:
 *   - Texts come from the caller and are written as text, never as markup.
 *   - Only `window.hvliProbeSaveChoice` is added to the page; the dialog is removed again when it closes.
 *   - The dialog's class is the probe's own (`hvl-probe-save-choice`): the editor page now links the production
 *     dialog's stylesheet (editorSaveChoice.css, for `.hvl-save-choice`), and the probe still shows the browser's own
 *     look before its stand-in stylesheet is linked.
 *   - `armOn` intercepts one click on the opener before editorPage.js sees it, so the probe never saves.
 * Collaborators: ./editorSaveDialogPage.ts (serves and loads this file), ./editorSaveDialogStyles.css.
 * Tests: ./editorSaveDialog.browser.int.test.ts, ./editorSaveDialogLook.browser.int.test.ts,
 *   ./editorSaveDialogCanvas.browser.int.test.ts
 */
/* global window, document */
'use strict';

(function hvliProbeSaveChoiceScript() {
  var probe = { log: [], results: [] };

  function element(tag, text, attributes) {
    var made = document.createElement(tag);
    if (text) made.textContent = text;
    Object.keys(attributes || {}).forEach(function (name) {
      made.setAttribute(name, attributes[name]);
    });
    return made;
  }

  // A11Y: WCAG 2.1.2, 2.4.3: Tab and Shift+Tab wrap inside the dialog, as apps/web's Dialog.tsx does; natively,
  // focus leaves the document after the last button (to the browser, or to Canvas's page around our frame).
  function wrapTab(dialog, buttons) {
    dialog.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab') return;
      var first = buttons[0];
      var last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  // WHY: Chromium lets a script inside the inert editor iframe focus its own fields while the dialog is open; Escape
  // then goes to that frame. When focus moves into a frame of this page that way, it is taken back after the frame's
  // handler. Focus that leaves for the page around ours (the web app's Rediger tab, Canvas) is left alone: taking it
  // back would send the keys the person types there into the dialog.
  function guardFrameFocus(dialog, home) {
    var guard = function () {
      setTimeout(function () {
        var active = document.activeElement;
        if (!dialog.open || !active || active.tagName !== 'IFRAME') return;
        window.focus();
        home.focus();
      }, 0);
    };
    window.addEventListener('blur', guard);
    dialog.addEventListener('close', function () {
      window.removeEventListener('blur', guard);
    });
  }

  /** Builds the dialog: a heading, a text and three buttons in a `method="dialog"` form; «Avbryt» has autofocus. */
  function build(texts) {
    var dialog = element('dialog', '', {
      id: 'hvl-save-choice',
      class: 'hvl-probe-save-choice',
      'aria-labelledby': 'hvl-save-choice-title',
      'aria-describedby': 'hvl-save-choice-text',
    });
    var form = element('form', '', { method: 'dialog' });
    form.append(element('h2', texts.title, { id: 'hvl-save-choice-title' }));
    form.append(element('p', texts.text, { id: 'hvl-save-choice-text' }));
    var row = element('p', '');
    var buttons = texts.choices.map(function (choice) {
      var attributes = { value: choice.value, id: 'hvl-save-choice-' + choice.value };
      if (choice.value === 'cancel') attributes.autofocus = '';
      return row.appendChild(element('button', choice.label, attributes));
    });
    form.append(row);
    dialog.append(form);
    return { dialog: dialog, buttons: buttons };
  }

  /** Opens the dialog; options: wrapTab, guardFrameFocus, focusVisible, opener, disableOpener, restoreFocus. */
  function open(texts, options) {
    var settings = options || {};
    var made = build(texts);
    var dialog = made.dialog;
    var cancel = dialog.querySelector('#hvl-save-choice-cancel');
    dialog.addEventListener('cancel', function (event) {
      probe.log.push('cancel' + (event.cancelable ? '' : ' (not cancelable)'));
    });
    dialog.addEventListener('close', function () {
      probe.log.push('close:' + dialog.returnValue);
      probe.results.push(dialog.returnValue || 'cancel');
      dialog.remove();
      if (settings.opener && settings.disableOpener) settings.opener.disabled = false;
      if (settings.opener && settings.restoreFocus) settings.opener.focus();
    });
    if (settings.wrapTab) wrapTab(dialog, made.buttons);
    document.body.append(dialog);
    dialog.showModal();
    // WHY: «Avbryt» already has focus (autofocus), and focusing the focused element again changes nothing. The
    // probe shows that Chromium 141 ignores the option anyway (./editorSaveDialogLook.browser.int.test.ts).
    if (settings.focusVisible) cancel.blur();
    if (settings.focusVisible) cancel.focus({ focusVisible: true });
    if (settings.guardFrameFocus) guardFrameFocus(dialog, cancel);
    return dialog;
  }

  /** Opens the dialog on the next click of `opener` instead of the click's own handlers (the probe never saves). */
  function armOn(opener, texts, options) {
    var settings = Object.assign({}, options, { opener: opener });
    var onClick = function (event) {
      if (event.target !== opener) return;
      // WHY: capture on window runs before the button's own listener (editorPage.js's save) and stops it.
      event.stopImmediatePropagation();
      window.removeEventListener('click', onClick, true);
      // WHY: as editorPage.js's save() does while its request runs; the answer that asks for a choice comes later.
      if (settings.disableOpener) opener.disabled = true;
      open(texts, settings);
    };
    window.addEventListener('click', onClick, true);
  }

  probe.open = open;
  probe.armOn = armOn;
  window.hvliProbeSaveChoice = probe;
})();
