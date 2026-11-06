# Draft: H5P accessibility report, H5P.Question 1.5

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-question` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **WCAG 2.2** | 1.3.1 Info and Relationships; 4.1.2 Name, Role, Value |
| **Our records** | D-080 (repair (k)), D-112 |
| **Checked** | 2026-11-05 against 1.5.47 (tag 1.5.47, commit fffb3c86) |

---

## Title

[Bug]: Accessibility: the explanation's title is `role="heading"` without `aria-level`

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- H5P.Question 1.5.47 (commit fffb3c86), seen through H5P.DragText 1.10.52; H5P Core 1.28.0.
- Chromium 141 (Playwright 1.56.1), axe-core 4.13.0. Our host runs Lumi's Node.js server; the markup comes from the
  library.

### Steps to reproduce

1. Create a Drag the Words with a tip or an explanation for a wrong answer.
2. Answer it wrongly and press "Check", so that the explanation is shown.
3. Run axe on the player document.

### Expected

The explanation's title is a heading with a level.

### Actual

`scripts/explainer.js` writes `<div class="h5p-question-explanation-title" role="heading">` with no `aria-level`,
which ARIA 1.2 requires for `role="heading"` (axe `aria-required-attr`, critical). Screen readers announce it with
a level of their own choosing, or not as a heading.

### Suggested fix

Add an `aria-level` (2 suits a content type in its own document, since the host page gives the activity's title),
or let the host pass a level.

### Our workaround

`packages/hvl-h5p-theme/src/a11yRepairs.js` adds `aria-level="2"` at run time. Our tests: `a11yRepairs.test.ts` and
`axeContentTypes.a11y.test.ts` (Drag the Words answered).
