# Draft: H5P accessibility report, H5P.DragNBar 1.5

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-drag-n-bar` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README). The missing Nynorsk and Bokmål texts go in a pull request to the library's language files instead (see the README) |
| **Status** | Ready |
| **WCAG 2.2** | 4.1.2 Name, Role, Value; 2.4.4 Link Purpose (In Context) |
| **Our records** | D-080 (repair (h)), D-111 (Nynorsk and Bokmål texts), D-112 |
| **Checked** | 2026-11-05 against 1.5.23 (tag 1.5.23, commit b475daaf) |

---

## Title

[Bug]: Accessibility: the toolbar's paste button has no accessible name

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- H5P.DragNBar 1.5.23 (commit b475daaf), in the editors of H5P.CoursePresentation 1.28 and H5P.InteractiveVideo
  1.28; H5P Core 1.28.0 and the editor client at `h5p-editor-php-library` commit ab2daa18.
- Chromium 141 (Playwright 1.56.1), axe-core 4.13.0. Our host runs Lumi's Node.js server; the markup comes from the
  library.

### Steps to reproduce

1. Open the editor for a new Course Presentation.
2. Run axe on the editor document, and move to the toolbar's paste button with a screen reader.

### Expected

The paste button is announced with its name ("Paste", or the translated text), as the toolbar's other buttons are.

### Actual

`scripts/drag-n-bar.js` names the element buttons with `aria-label`, but writes the paste button as an empty
`<a href="#" class="h5p-dragnbar-a h5p-dragnbar-paste-button"></a>`; its name is only in the tooltip beside it
(`.h5p-dragnbar-tooltip`), which is not connected to it (axe `link-name`, serious).

### Suggested fix

`aria-label` on the paste button from the same text as its tooltip (or `aria-describedby` to it), as for the other
buttons; ideally a `<button>`, since it does not navigate.

### Our workaround

`packages/hvl-h5p-theme/src/a11yEditorRepairs.js` gives a toolbar button without a name its tooltip's text as
`aria-label`. Our tests: `a11yEditorRepairs.test.ts`; `axeEditor.a11y.test.ts`.
