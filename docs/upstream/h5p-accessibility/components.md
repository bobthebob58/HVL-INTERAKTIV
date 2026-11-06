# Draft: H5P accessibility report, H5P.Components 1.0

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-components` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **WCAG 2.2** | 4.1.2 Name, Role, Value; 1.4.11 Non-text Contrast; 2.5.8 Target Size (Minimum) |
| **Our records** | D-080 (repair (c), amendment V2T-1 to V2T-3), D-112 |
| **Checked** | 2026-11-05 against 1.0.99 (tag 1.0.99, commit 223a9164) |

---

## Title

[Bug]: Accessibility: drop zones have `aria-label` without a role, an empty inline drop zone's border is 1.38 : 1, and the navigation's `overflow: hidden` cuts its buttons

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- H5P.Components 1.0.99 (commit 223a9164), used by H5P.DragText 1.10.52 and H5P.CoursePresentation 1.28.25; H5P Core
  1.28.0.
- Chromium 141 (Playwright 1.56.1), axe-core 4.13.0. Our host runs Lumi's Node.js server; the markup comes from the
  library.

### Steps to reproduce

1. Create a Drag the Words with two blanks. Open it and run axe on the player document.
2. Compare the border of an empty inline drop zone with its container.
3. Open a Course Presentation at 320 CSS px wide and measure the footer's «Previous slide» and «Next slide».

### Expected

- A drop zone with a name has a role that allows one (for example `role="group"`, since a dropped word, a button,
  sits inside it).
- An empty drop zone's border reaches 3 : 1 against its container.
- The navigation's buttons are not cut by their container.

### Actual

1. `src/components/h5p-dropzone.js` writes `<div aria-dropeffect="none" aria-label="…" tabindex="-1">` with no role
   (axe `aria-prohibited-attr`, serious): the label is not announced.
2. `src/styles/h5p-dropzone.css` draws an empty inline drop zone in `alternative-dark` on `alternative-light`:
   1.38 : 1.
3. `src/styles/h5p-navigation.css` makes the navigation a size container with `overflow: hidden`; in Course
   Presentation's footer at phone width it cuts 7 to 9 px off each slide button.

### Suggested fix

- `role="group"` on a drop zone that has an `aria-label` (not `button`: the dropped word inside it is a button).
- A border colour for the empty zone with at least 3 : 1 against its container.
- Let the navigation's buttons size the container, or drop `overflow: hidden` there.

### Our workaround

`packages/hvl-h5p-theme/src/a11yRepairs.js` gives each labelled drop zone `role="group"`;
`packages/hvl-h5p-theme/src/hvl-h5p-indicators.css` gives the empty zone a darker border (7.02 : 1);
`packages/hvl-h5p-theme/src/hvl-h5p-targets.css` widens Course Presentation's middle footer column so the buttons
fit.

Our tests: `a11yRepairs.test.ts`; `a11yRepairs.browser.int.test.ts` ("[UD-006] DragText: a word dropped by keyboard
lands in a drop zone that is a named group"); `axeContentTypes.a11y.test.ts`;
`hvlThemeIndicators.browser.int.test.ts`; `targetSize.a11y.test.ts`.
