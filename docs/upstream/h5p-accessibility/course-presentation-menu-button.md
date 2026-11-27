# Draft: H5P accessibility report, H5P.CoursePresentation 1.28, the slide-menu button's name

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-course-presentation` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **WCAG 2.2** | 2.5.3 Label in Name |
| **Our records** | D-151 (repair (l)), D-080 |
| **Checked** | 2026-11-27 against 1.28.25 (tag 1.28.25, commit 369d140c) |

---

## Title

[Bug]: Accessibility: the footer's slide-menu button shows the slide title but is named "Show sidebar navigation menu" (WCAG 2.5.3)

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 159, through Playwright 1.65.1)
- **Operating system:** Linux, Ubuntu 24.04

### Versions

- H5P.CoursePresentation 1.28.25 (commit 369d140c); H5P Core 1.28.0.
- Chromium 159 (Playwright 1.65.1), axe-core 4.14.1. Our host runs Lumi's Node.js server; the markup comes from
  the library.

### Steps to reproduce

1. Create a Course Presentation with slide titles ("keywords") and the slide menu not always shown.
2. View it and run axe on the player document (axe-core 4.14 runs `label-content-name-mismatch` by default), or
   read the footer button's accessible name in the browser's accessibility tree.

### Expected

The button's accessible name contains the text the button shows, so that a person who uses speech input and says
the words on the button reaches it (WCAG 2.5.3).

### Actual

`src/scripts/navigation-line.js` creates

```html
<div class="h5p-footer-button h5p-footer-toggle-keywords" role="button" tabindex="0" aria-expanded="false"
     aria-label="Show sidebar navigation menu">
  <span class="h5p-icon-menu"></span><span class="current-slide-title">Three phases</span>
</div>
```

The button shows the current slide's title, and its name is the `aria-label` alone ("Show sidebar navigation
menu", then "Hide sidebar navigation menu"); axe reports `label-content-name-mismatch` (serious).

### Suggested fix

Keep the shown title in the name, for example with `aria-labelledby` that names the title element and then the
button itself (a reference to itself reads its own `aria-label`), which also keeps the tooltip's text; or move the
action to an `aria-description` and let the title be the name.

### Our workaround

`packages/hvl-h5p-theme/src/a11yRepairs.js` gives the title and the button an `id` and sets
`aria-labelledby="<title> <button>"` at run time; the `aria-label` stays, since `H5P.Tooltip` shows it. Our tests:
`a11yRepairsLabelInName.test.ts` and the axe suites that play a Course Presentation
(`axeContentTypes.a11y.test.ts`).
