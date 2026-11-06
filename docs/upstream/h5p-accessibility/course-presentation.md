# Draft: H5P accessibility report, H5P.CoursePresentation 1.28

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-course-presentation` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **WCAG 2.2** | 4.1.2 Name, Role, Value; 1.3.1 Info and Relationships; 2.5.8 Target Size (Minimum); 1.4.11 Non-text Contrast |
| **Our records** | D-080 (repairs (a) and (b), amendments NEW-4 and V2T-1 to V2T-3), D-112 |
| **Checked** | 2026-11-05 against 1.28.25 (tag 1.28.25, commit 369d140c) |

---

## Title

[Bug]: Accessibility: Course Presentation's progress bar is a tab list of non-tabs, and its bar and footer controls are below 24 px on phones

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- H5P.CoursePresentation 1.28.25 (commit 369d140c), H5P.Components 1.0.99, H5P Core 1.28.0.
- Chromium 141 (Playwright 1.56.1), axe-core 4.13.0; widths 320, 390 and 640 CSS px. Our host runs Lumi's Node.js
  server; the markup below comes from the library.

### Steps to reproduce

1. Create a Course Presentation with four slides, one of them holding a question.
2. Open it and run axe on the player document.
3. Open it at 320 × 640 and at 390 × 844 CSS px, in the page and in full screen, and measure the progress bar's
   parts and the footer's buttons («Previous slide», «Next slide», «Show side menu», «Full screen»).
4. Answer the question, move to another slide and compare an answered task dot with an unanswered one.

### Expected

- The progress bar is either a real tab list (tabs that are not containers of other focusable elements, and slides
  that are their panels) or a list of named links. Every link has a name.
- Every control in the footer and the bar is at least 24 × 24 CSS px, or has an equivalent control that is.
- An answered dot differs from an unanswered one by at least 3 : 1.

### Actual

1. `src/scripts/cp.js` writes the bar as `role="tablist"`, and `src/scripts/navigation-line.js` fills it with
   `<div role="tab">` parts, each holding the focusable `<a href="#">` that the arrow keys move between (axe
   `nested-interactive`, serious). A part for a slide
   without a title has an empty link text (axe `link-name`, serious). The current part carries `aria-selected` on the
   `div`, and the summary slide's part has `aria-controls="slide-<n>"` for a slide that `cp.js` creates without an
   index (`id="slide-undefined"`), so it points at no element.
2. `src/scripts/slide.js` makes each slide the `role="tabpanel"` of its part, so the slides are panels of tabs that
   assistive technology cannot use as tabs.
3. The bar is 3 % of the player's height (about 5 px at 320 px wide) and the footer 7 % (11 to 15 px on a phone).
   The footer's 24 to 29 px buttons are cut off by the player's `overflow: hidden`, and the bar's links lie over
   their top: at 320 px a pointer reached «Next slide» in 15 × 11 px. In full screen the bar's parts are 5 to 10 px
   high and lie over the footer's controls.
4. An answered task dot is filled with `main-contrast-cta`, 2.67 : 1 against the dot's ring on a slide not yet
   reached (`src/styles/navigation-line.css`).

### Suggested fix

- Write the bar as a list of links: `<ol>` of `<li>`, each with one link named by its slide's title, the current one
  with `aria-current="step"`, and the slides as groups (`role="group"`) named by their title. The arrow-key
  navigation can stay.
- Give the bar and the footer at least 24 px each at every size, outside and inside full screen, so that neither
  covers the other.
- Fill an answered dot with a colour that reaches 3 : 1 against an unanswered one, also in forced colours.

### Our workaround

- `packages/hvl-h5p-theme/src/a11yRepairs.js` turns the bar into a list of named links and the slides into named
  groups, at run time, without touching H5P's handlers or focus order.
- `packages/hvl-h5p-theme/src/hvl-h5p-targets.css` gives the bar and the footer 24 px and grows the player by what
  that adds; `packages/hvl-h5p-theme/src/hvl-h5p-indicators.css` fills an answered dot with its ring's colour.

Our tests: `a11yRepairs.test.ts`; `a11yRepairs.browser.int.test.ts` ("[UD-006] CoursePresentation's progress bar is
a list of named links that still moves by arrow keys and Enter"); `axeContentTypes.a11y.test.ts`;
`reflowAndMotion.a11y.test.ts` and `targetSize.a11y.test.ts` (every control reached by a pointer over 24 × 24 px,
in the page and in full screen); `hvlThemeIndicators.browser.int.test.ts`.
