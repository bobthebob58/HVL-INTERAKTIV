# Draft: H5P accessibility report, H5PEditor.ImageCoordinateSelector 1.2

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-editor-image-coordinate-selector` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **WCAG 2.2** | 2.1.1 Keyboard; 1.1.1 Non-text Content |
| **Our records** | D-080 (repair (g), amendment DOC-9 and the pin amendment), D-112; manual test protocol §8 |
| **Checked** | 2026-11-05 against 1.2.7 (tag 1.2.7, commit 53bd5903) |

---

## Title

[Bug]: Accessibility: a hotspot's position can be set with a pointer only, and the picker's image has no `alt`

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- H5PEditor.ImageCoordinateSelector 1.2.7 (commit 53bd5903), in the editor of H5P.ImageHotspots 1.11.6; H5P Core
  1.28.0 and the editor client at `h5p-editor-php-library` commit ab2daa18.
- Chromium 141 (Playwright 1.56.1), axe-core 4.13.0. Our host runs Lumi's Node.js server; the markup comes from the
  widget.

### Steps to reproduce

1. Open the editor for an Image Hotspots with a background image, and add a hotspot.
2. Using the keyboard only, try to move the new hotspot: Tab to the position picker, press the arrow keys, Enter and
   Space.
3. Run axe on the editor document.

### Expected

- The position can be set without a pointer: the picker takes focus and moves by arrow keys, or x and y fields are
  offered.
- The picker's copy of the background image is decorative (`alt=""`), since the image's own alternative text has a
  field of its own.

### Actual

- `scripts/image-coordinate-selector.js` makes the picker a `<div>` with a click handler only: no `tabindex`, no key
  handler, no x or y field. A new hotspot starts at 50 % / 50 %, and a keyboard-only author cannot move it.
- The picker's `<img>` has no `alt` (axe `image-alt`, critical).

### Suggested fix

- Make the picker focusable and move the point with the arrow keys (with a larger step on Shift), or show two number
  fields for x and y in per cent beside it.
- `alt=""` on the picker's image.

### Our workaround

`packages/hvl-h5p-theme/src/a11yEditorRepairs.js` gives the image `alt=""`. Keyboard input cannot be added by
attributes; our manual test protocol lists it. Our tests: `a11yEditorRepairs.test.ts`; `axeEditor.a11y.test.ts`;
`upstreamPins.browser.int.test.ts` ("upstream pin: H5PEditor.ImageCoordinateSelector 1.2 places a hotspot by
pointer only", which presses arrow keys, Enter and Space on the picker and fails once a pinned version moves the
hotspot).
