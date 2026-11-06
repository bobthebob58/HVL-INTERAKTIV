# Draft: H5P accessibility report, H5P.BranchingScenario 1.10

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-branching-scenario` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **WCAG 2.2** | 1.1.1 Non-text Content |
| **Our records** | D-080 (amendments of 2026-10-28 and 2026-10-29), D-112 |
| **Checked** | 2026-11-05 against 1.10.1 (tag 1.10.1, commit 6860e97e) |

---

## Title

[Bug]: Accessibility: the default start and end pictures have no `alt`

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- H5P.BranchingScenario 1.10.1 (commit 6860e97e); H5P Core 1.28.0.
- Chromium 141 (Playwright 1.56.1), axe-core 4.13.0. Our host runs Lumi's Node.js server; the markup comes from the
  library.

### Steps to reproduce

1. Create a Branching Scenario without a start screen image and without an end screen image.
2. Open it, and run axe on the start screen; play it to an end screen and run axe again.

### Expected

The default pictures are decorative and have `alt=""` (or a text alternative, if they are meant to say something).

### Actual

`src/scripts/genericScreen.js` shows `dist/assets/start-screen-default.jpg` and `end-screen-default.jpg` as
`<img class="h5p-background-image">` with no `alt` attribute (axe `image-alt`, critical), so screen readers may
read the file name. An author's own image is written with its alternative text as `aria-label`, which is fine.

### Suggested fix

Write `alt=""` on the default pictures.

### Our workaround

`packages/hvl-h5p-theme/src/a11yRepairs.js` sets `alt=""` on an `img.h5p-background-image` whose source is one of
the two default pictures. Our tests: `a11yRepairs.test.ts` and `axeContentTypes.a11y.test.ts`.
