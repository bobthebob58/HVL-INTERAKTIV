# Draft: H5P accessibility report, H5PEditor.VerticalTabs 1.3

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-editor-vertical-tabs` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **WCAG 2.2** | 2.1.1 Keyboard; 4.1.2 Name, Role, Value; 1.3.1 Info and Relationships |
| **Our records** | D-080 (repair (e), the keyboard barriers of the repairs amendment), D-112; manual test protocol §8 |
| **Checked** | 2026-11-05 against 1.3.16 (tag 1.3.16, commit 20df230e) |

---

## Title

[Bug]: Accessibility: vertical tabs are a tab list that holds other buttons, and a tab does not open on Enter

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- H5PEditor.VerticalTabs 1.3.16 (commit 20df230e), seen in the editors of H5P.QuestionSet 1.21, H5P.InteractiveBook
  1.15 and H5P.ImageHotspots 1.11; H5P Core 1.28.0 and the editor client at `h5p-editor-php-library` commit ab2daa18.
- Chromium 141 (Playwright 1.56.1), axe-core 4.13.0. Our host runs Lumi's Node.js server; the markup comes from the
  widget.

### Steps to reproduce

1. Open the editor for a Question Set with two questions.
2. Run axe on the editor document.
3. Tab to the second question's item in the vertical list and press Enter; then press Space.

### Expected

- The structure is valid: either a tab list of tabs only, or a list whose items hold a button to open the item and
  its remove and order buttons.
- Enter and Space both open the item.

### Actual

- `vertical-tabs.js` writes `<ol role="tablist">` whose `<li class="h5p-vtab-li">` items hold a
  `<div class="h5p-vtab-a" role="tab">` beside the item's remove and order buttons, which a tab list may not contain
  (axe `aria-required-children`, `aria-required-parent` and `listitem`, all serious). Each item's form is a
  `<fieldset role="tabpanel">`.
- Space opens the item; Enter does nothing.

### Suggested fix

A list (`<ol>` without a role) whose items hold a real button that opens the item (with `aria-current` or
`aria-expanded` for the open one) next to the remove and order buttons; forms as plain fieldsets; Enter and Space on
the button.

### Our workaround

`packages/hvl-h5p-theme/src/a11yEditorRepairs.js` makes the `<ol>` a list again, each "tab" a button (the open item
`aria-current`) and each form a plain group. Enter cannot be added by attributes; our manual test protocol lists it.
Our tests: `a11yEditorRepairs.test.ts`; `a11yRepairs.browser.int.test.ts` ("[UD-006] the editor's vertical tabs are
buttons that open with Space, their forms plain groups" and the pin "upstream pin: H5PEditor.VerticalTabs 1.3 does
not open an item on Enter", which fails once a pinned version opens it); `axeEditor.a11y.test.ts`.
