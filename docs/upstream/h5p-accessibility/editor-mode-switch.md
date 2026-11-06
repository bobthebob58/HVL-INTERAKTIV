# Draft: H5P accessibility report, the H5P editor's mode switch

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-editor-php-library` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **WCAG 2.2** | 2.1.1 Keyboard; 2.4.3 Focus Order; 4.1.2 Name, Role, Value; 1.3.1 Info and Relationships; 1.4.1 Use of Color |
| **Our records** | D-080 (repair (f), the keyboard barriers of the repairs amendment), D-112; manual test protocol §8 |
| **Checked** | 2026-11-05 against commit ab2daa18 |

---

## Title

[Bug]: Accessibility: the editor-mode switch (for example Question Set's "Default" and "Textual") cannot be used by keyboard, and its state is shown by colour only

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- `h5p-editor-php-library` at commit ab2daa18 (`scripts/h5peditor-semantic-structure.js`), with H5P.QuestionSet
  1.21.13 and H5PEditor.QuestionSetTextualEditor 1.3.18; H5P Core 1.28.0.
- Chromium 141 (Playwright 1.56.1), axe-core 4.13.0. Our host runs Lumi's Node.js server; the markup comes from the
  editor client.

### Steps to reproduce

1. Open the editor for a new Question Set.
2. Tab to the editor-mode switch ("Default" / "Textual") above the questions, and press Enter, then Space.
3. Run axe on the editor document, and listen to the switch with a screen reader.

### Expected

- Enter or Space on a mode switches to it.
- The switch follows the page's Tab order.
- The switch is announced as a group with its title, and the active mode as selected or pressed.

### Actual

- Enter and Space do nothing: the modes answer a click only.
- Its items have `tabindex="1"`, so they come first in the Tab order, before the rest of the page.
- It is a `<ul class="h5peditor-widget-select">` whose items are `role="button"`, so it is no longer a list
  (axe `list`, serious), and the active mode is shown by colour only.

### Suggested fix

Real buttons (`<button type="button">`) in a group named by the switch's title, the active one with
`aria-pressed="true"`, no positive `tabindex`; or a radio group.

### Our workaround

`packages/hvl-h5p-theme/src/a11yEditorRepairs.js` makes the list a group named by its title and marks the active
mode with `aria-pressed`. Keyboard use and the `tabindex` cannot be repaired by attributes; our manual test
protocol lists them. Our tests: `a11yEditorRepairs.test.ts`; `a11yRepairs.browser.int.test.ts` ("[UD-030]
QuestionSet's editor: the editor-mode switch shows its active mode as pressed, the "to" field is named" and the pin
"upstream pin: H5PEditor's editor-mode switch answers neither Enter nor Space", which fails once a pinned editor
answers them); `axeEditor.a11y.test.ts`.
