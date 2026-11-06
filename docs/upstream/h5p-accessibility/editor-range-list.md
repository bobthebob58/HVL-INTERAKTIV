# Draft: H5P accessibility report, H5PEditor.RangeList 1.0

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-editor-range-list` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **WCAG 2.2** | 1.3.1 Info and Relationships; 4.1.2 Name, Role, Value; 3.3.2 Labels or Instructions |
| **Our records** | D-080 (repair (d)), D-112 |
| **Checked** | 2026-11-05 against 1.0.13 (tag 1.0.13, commit d1e11189) |

---

## Title

[Bug]: Accessibility: the score range's "to" field has no label

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- H5PEditor.RangeList 1.0.13 (commit d1e11189), seen in the "Overall feedback" of H5P.MultiChoice 1.16 and other
  question types; H5P Core 1.28.0 and the editor client at `h5p-editor-php-library` commit ab2daa18.
- Chromium 141 (Playwright 1.56.1), axe-core 4.13.0. Our host runs Lumi's Node.js server; the markup comes from the
  widget.

### Steps to reproduce

1. Open the editor for a new Multiple Choice and open "Overall feedback".
2. Add a score range.
3. Run axe on the editor document, and move to the range's "to" field with a screen reader.

### Expected

Each "to" field has an accessible name, for example "Score range 51 % – to".

### Actual

`h5p-editor-range-list.js` builds the table with TableList, which moves the labels into the column headings; the
"to" column has no heading of its own, so its `<input class="h5peditor-text" id="field-to-<n>">` keeps an empty
`<label>` (axe `label`, critical). A screen reader announces an unnamed text field.

### Suggested fix

Give the "to" input a name: an `aria-labelledby` that points at the range heading, the row's "from" value and the
dash, or a visually hidden label.

### Our workaround

`packages/hvl-h5p-theme/src/a11yEditorRepairs.js` adds `aria-labelledby` to each "to" field (heading, the row's
"from" value, the dash), so it reads as the row reads on screen. Our tests: `a11yEditorRepairs.test.ts`;
`a11yRepairs.browser.int.test.ts` ("[UD-030] QuestionSet's editor: the editor-mode switch shows its active mode as
pressed, the "to" field is named"); `axeEditor.a11y.test.ts`.
