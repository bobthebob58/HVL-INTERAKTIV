# WCAG 2.2 conformance report

> Requirement `UD-040` (spec 03 §6): every WCAG 2.2 Level A and AA success criterion with HVL’s verdict, the evidence and the known H5P upstream limitations, as the input for HVL’s accessibility statement on uustatus.no. Decision D-079 and its amendment for `UD-040`.

**How this file is made.** `npm run a11y:report` writes it from the committed summary of the last full run of the accessibility suite ([automated-run.json](automated-run.json)), the evidence map in [`tools/a11y-report/`](../../tools/a11y-report/README.md), axe-core’s rule tags, the [manual test protocol](manual-test-protocol.md), the [results folder](results/README.md) and the register of H5P upstream barriers. **Only the blocks marked as manual are written by people**, between the HTML comments `manual:start` and `manual:end` that carry the block’s name: the generator copies them unchanged and rewrites everything else, so edit nothing outside them. After a full run, `npm run a11y:report -- --from-run=<folder>` (or `npm run a11y:report -- --run`) records it; `npm run a11y:report -- --check` fails when this file differs from what its sources give.

**What the automated part can and cannot show.** axe and our browser checks find only part of the barriers (protocol §1). They show where a criterion is checked and what the last run found; they never decide a verdict. A verdict is HVL’s, written in the criterion’s manual block, and the summary copies it.

**What a criterion’s manual block holds.** The line `**Verdict:**` with one of *Supports*, *Partially supports*, *Does not support*, *Not applicable* or *Not yet determined*; under *Evaluated by HVL* the date, the evaluator’s role and initials and the result files (as [results/README.md](results/README.md) names them); and the manual evidence and remarks. *Not yet tested by HVL* stays until HVL has evaluated the criterion.

| | |
|---|---|
| Product | HVL Interaktiv: the web app, the server-rendered pages, the Canvas views and the ten H5P content types with the HVL theme |
| Standard | WCAG 2.2, Level A and AA: 56 success criteria (4.1.1 *Parsing* included for WCAG 2.1 and EN 301 549) |
| Last automated run | 2026-11-05, commit `5064a494937f` (with uncommitted changes): 508 passed, 0 failed, 0 skipped (appendix A) |
| Manual results | none recorded yet (*not yet tested by HVL*) |
| Automated tools | axe-core 4.13.0 with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`; Playwright in Chromium (D-079) |

## 1. Scope and method (manual)

<!-- manual:start scope -->
**Status:** draft by the development team, 2026-11-05. *Not yet reviewed by HVL.*

**In scope:** the web app (`apps/web`: the portal, an activity's tabs, the læringsdesign studio, `/mappe` and the
Canvas views under `/app/`), the server-rendered pages (the Deep Linking picker, the H5P player and editor pages, the
error pages), the ten authorable H5P content types with the HVL theme and the run-time repairs (D-080), and the
portfolio PDF (`MAPPE-004`).

**Not in scope:** Canvas and Feide themselves; what authors write into an activity (alternative text, captions,
transcripts, language), which the pre-publish validator checks only in part (`UD-021`).

**Method:** automated, in Chromium only (D-079): `npm run test:a11y` (axe-core with the WCAG 2.2 A and AA tags,
keyboard walks and journeys, reflow, text spacing and zoom, target size, reduced motion, language), the component and
browser tests of `npm test`, and the pre-publish validator. Manual: the [protocol](manual-test-protocol.md) with
NVDA, JAWS, VoiceOver, keyboard only and 400 % zoom (`UD-031`), and the browser matrix of
[nfr-003-matrix.md](nfr-003-matrix.md) (`NFR-003`). *Not yet tested by HVL.*
<!-- manual:end scope -->

## 2. Summary

| Criterion | Level | Verdict (HVL) | Automated checks | Protocol steps and checks |
|---|---|---|---|---|
| [1.1.1 Non-text Content](#111-non-text-content) | A | Not yet determined | axe: 7, tests: 3 | 1 |
| [1.2.1 Audio-only and Video-only (Prerecorded)](#121-audio-only-and-video-only-prerecorded) | A | Not yet determined | tests: 1 | 0 |
| [1.2.2 Captions (Prerecorded)](#122-captions-prerecorded) | A | Not yet determined | axe: 1, tests: 1 | 0 |
| [1.2.3 Audio Description or Media Alternative (Prerecorded)](#123-audio-description-or-media-alternative-prerecorded) | A | Not yet determined | tests: 1 | 0 |
| [1.2.4 Captions (Live)](#124-captions-live) | AA | Not yet determined | none | 0 |
| [1.2.5 Audio Description (Prerecorded)](#125-audio-description-prerecorded) | AA | Not yet determined | none | 0 |
| [1.3.1 Info and Relationships](#131-info-and-relationships) | A | Not yet determined | axe: 9, tests: 3 | 5 |
| [1.3.2 Meaningful Sequence](#132-meaningful-sequence) | A | Not yet determined | tests: 1 | 2 |
| [1.3.3 Sensory Characteristics](#133-sensory-characteristics) | A | Not yet determined | tests: 1 | 0 |
| [1.3.4 Orientation](#134-orientation) | AA | Not yet determined | suite: 1 | 1 |
| [1.3.5 Identify Input Purpose](#135-identify-input-purpose) | AA | Not yet determined | axe: 1 | 0 |
| [1.4.1 Use of Color](#141-use-of-color) | A | Not yet determined | axe: 1, tests: 3 | 3 |
| [1.4.2 Audio Control](#142-audio-control) | A | Not yet determined | axe: 1 | 0 |
| [1.4.3 Contrast (Minimum)](#143-contrast-minimum) | AA | Not yet determined | axe: 1, tests: 2 | 0 |
| [1.4.4 Resize Text](#144-resize-text) | AA | Not yet determined | axe: 1, suite: 1, tests: 1 | 1 |
| [1.4.5 Images of Text](#145-images-of-text) | AA | Not yet determined | none | 0 |
| [1.4.10 Reflow](#1410-reflow) | AA | Not yet determined | suite: 1 | 3 |
| [1.4.11 Non-text Contrast](#1411-non-text-contrast) | AA | Not yet determined | tests: 3 | 1 |
| [1.4.12 Text Spacing](#1412-text-spacing) | AA | Not yet determined | axe: 1, suite: 1 | 1 |
| [1.4.13 Content on Hover or Focus](#1413-content-on-hover-or-focus) | AA | Not yet determined | none | 0 |
| [2.1.1 Keyboard](#211-keyboard) | A | Not yet determined | axe: 3, suite: 4, tests: 1 | 6 |
| [2.1.2 No Keyboard Trap](#212-no-keyboard-trap) | A | Not yet determined | suite: 2 | 3 |
| [2.1.4 Character Key Shortcuts](#214-character-key-shortcuts) | A | Not yet determined | none | 0 |
| [2.2.1 Timing Adjustable](#221-timing-adjustable) | A | Not yet determined | axe: 1 | 0 |
| [2.2.2 Pause, Stop, Hide](#222-pause-stop-hide) | A | Not yet determined | axe: 2, suite: 1, tests: 1 | 1 |
| [2.3.1 Three Flashes or Below Threshold](#231-three-flashes-or-below-threshold) | A | Not yet determined | none | 1 |
| [2.4.1 Bypass Blocks](#241-bypass-blocks) | A | Not yet determined | axe: 1, suite: 1, tests: 1 | 2 |
| [2.4.2 Page Titled](#242-page-titled) | A | Not yet determined | axe: 1, tests: 1 | 1 |
| [2.4.3 Focus Order](#243-focus-order) | A | Not yet determined | suite: 2, tests: 1 | 4 |
| [2.4.4 Link Purpose (In Context)](#244-link-purpose-in-context) | A | Not yet determined | axe: 2, tests: 2 | 1 |
| [2.4.5 Multiple Ways](#245-multiple-ways) | AA | Not yet determined | none | 0 |
| [2.4.6 Headings and Labels](#246-headings-and-labels) | AA | Not yet determined | none | 4 |
| [2.4.7 Focus Visible](#247-focus-visible) | AA | Not yet determined | suite: 1, tests: 1 | 1 |
| [2.4.11 Focus Not Obscured (Minimum)](#2411-focus-not-obscured-minimum) | AA | Not yet determined | suite: 1 | 1 |
| [2.5.1 Pointer Gestures](#251-pointer-gestures) | A | Not yet determined | none | 0 |
| [2.5.2 Pointer Cancellation](#252-pointer-cancellation) | A | Not yet determined | none | 0 |
| [2.5.3 Label in Name](#253-label-in-name) | A | Not yet determined | none | 0 |
| [2.5.4 Motion Actuation](#254-motion-actuation) | A | Not yet determined | none | 0 |
| [2.5.7 Dragging Movements](#257-dragging-movements) | AA | Not yet determined | tests: 1 | 1 |
| [2.5.8 Target Size (Minimum)](#258-target-size-minimum) | AA | Not yet determined | axe: 1, suite: 2, tests: 1 | 0 |
| [3.1.1 Language of Page](#311-language-of-page) | A | Not yet determined | axe: 3, suite: 1, tests: 1 | 1 |
| [3.1.2 Language of Parts](#312-language-of-parts) | AA | Not yet determined | axe: 1, suite: 2, tests: 2 | 4 |
| [3.2.1 On Focus](#321-on-focus) | A | Not yet determined | none | 0 |
| [3.2.2 On Input](#322-on-input) | A | Not yet determined | suite: 1 | 2 |
| [3.2.3 Consistent Navigation](#323-consistent-navigation) | AA | Not yet determined | tests: 1 | 0 |
| [3.2.4 Consistent Identification](#324-consistent-identification) | AA | Not yet determined | none | 0 |
| [3.2.6 Consistent Help](#326-consistent-help) | A | Not yet determined | tests: 1 | 1 |
| [3.3.1 Error Identification](#331-error-identification) | A | Not yet determined | tests: 1 | 2 |
| [3.3.2 Labels or Instructions](#332-labels-or-instructions) | A | Not yet determined | axe: 1 | 4 |
| [3.3.3 Error Suggestion](#333-error-suggestion) | AA | Not yet determined | tests: 1 | 2 |
| [3.3.4 Error Prevention (Legal, Financial, Data)](#334-error-prevention-legal-financial-data) | AA | Not yet determined | suite: 1 | 2 |
| [3.3.7 Redundant Entry](#337-redundant-entry) | A | Not yet determined | tests: 1 | 1 |
| [3.3.8 Accessible Authentication (Minimum)](#338-accessible-authentication-minimum) | AA | Not yet determined | tests: 1 | 0 |
| [4.1.1 Parsing](#411-parsing) | A | Not yet determined | none | 0 |
| [4.1.2 Name, Role, Value](#412-name-role-value) | A | Not yet determined | axe: 28, tests: 2 | 4 |
| [4.1.3 Status Messages](#413-status-messages) | AA | Not yet determined | suite: 3, tests: 1 | 6 |

Verdicts: Supports 0 · Partially supports 0 · Does not support 0 · Not applicable 0 · Not yet determined 56.

## 3. Assistive-technology runs

No manual run is recorded in [results/](results/README.md) yet: the assistive-technology protocol is *not yet tested by HVL*.

<!-- manual:start assistive-technology -->
**Status:** 2026-11-05: *not yet tested by HVL.* No run of the protocol is recorded. The runs due are listed in
[results/README.md](results/README.md). For each recorded run, HVL writes here the date, the release, the set-up,
the tester's role and the barriers found with their criteria, and copies the verdicts into the criteria below.
<!-- manual:end assistive-technology -->

## 4. Cognitive review (manual)

<!-- manual:start cognitive-review -->
**Status:** 2026-11-05: *not yet done.* Neither HVL nor testers with cognitive or learning disabilities have reviewed
the language, the structure or the help of HVL Interaktiv. Who does it, and how, is for HVL to decide.
<!-- manual:end cognitive-review -->

## 5. Barriers axe cannot see (manual)

The protocol’s [§8](manual-test-protocol.md#8-known-h5p-problems-to-expect) lists the known H5P problems testers should expect, among them barriers in the editor that axe cannot see (D-080).

<!-- manual:start barriers-axe-cannot-see -->
**Status:** draft by the development team, 2026-11-05, from D-080 and the protocol's §8. *Not yet confirmed by HVL
with assistive technology.*

- H5P editor, keyboard (2.1.1): QuestionSet's editor-mode switch does nothing on Enter or Space (its items have
  `tabindex="1"`); the vertical-tab buttons of QuestionSet, InteractiveBook and ImageHotspots open with Space only,
  not with Enter; the hotspot position picker of ImageHotspots works with a pointer only.
- CoursePresentation in full screen (2.5.8): the progress bar is H5P's own there, and its parts are smaller than
  24 px; the side menu and the previous and next buttons are the equivalent controls D-080 relies on.
- BranchingScenario editor (4.1.2, 1.4.3): the disabled «Paste» item is not announced as disabled, and it stays
  faded in a contrast theme (it is also in §10).
- Repaired at run time but still to be reported upstream (D-080): BranchingScenario's default start and end pictures
  have no `alt` in H5P's code; the repair marks them decorative (`alt=""`).
<!-- manual:end barriers-axe-cannot-see -->

## 6. Perceivable

### 1.1.1 Non-text Content

Level A · since WCAG 2.0 · [Understanding 1.1.1](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html)

<!-- manual:start sc-1.1.1 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.1.1 -->

**Automated evidence (generated):**

- axe [`aria-meter-name`](https://dequeuniversity.com/rules/axe/4.13/aria-meter-name), [`aria-progressbar-name`](https://dequeuniversity.com/rules/axe/4.13/aria-progressbar-name), [`image-alt`](https://dequeuniversity.com/rules/axe/4.13/image-alt), [`input-image-alt`](https://dequeuniversity.com/rules/axe/4.13/input-image-alt), [`object-alt`](https://dequeuniversity.com/rules/axe/4.13/object-alt), [`role-img-alt`](https://dequeuniversity.com/rules/axe/4.13/role-img-alt), [`svg-img-alt`](https://dequeuniversity.com/rules/axe/4.13/svg-img-alt). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.
- `UD-021` `V-IMG-ALT`: The pre-publish validator: an image without alternative text, or with a file name as its text, is an error the author fixes or acknowledges with a reason. Runs in `npm test`: [`apps/server/test/validation/rules/imageAltRule.test.ts`](../../apps/server/test/validation/rules/imageAltRule.test.ts) (3 test titles).
- `UD-021` `V-IMG-ALT-LENGTH`: The validator warns about alternative text over 250 characters. Runs in `npm test`: [`apps/server/test/validation/rules/imageAltLengthRule.test.ts`](../../apps/server/test/validation/rules/imageAltLengthRule.test.ts) (1 test title).
- `INS-008`: Every insight chart has a visible data table and a text summary. Runs in `npm test`: [`apps/web/test/features/insight/InsightCharts.test.tsx`](../../apps/web/test/features/insight/InsightCharts.test.tsx) (3 test titles), [`apps/web/test/features/insight/InsightMisconceptions.test.tsx`](../../apps/web/test/features/insight/InsightMisconceptions.test.tsx) (1 test title), [`apps/web/test/features/insight/insightFormat.test.ts`](../../apps/web/test/features/insight/insightFormat.test.ts) (2 test titles), [`apps/web/test/features/insight/insightSummaries.test.ts`](../../apps/web/test/features/insight/insightSummaries.test.ts) (1 test title).

**Manual protocol:** J3.2 «Read the per-question results.»

**Scope note:** The validator checks that an authored image has alternative text and that it is not a file name, not that it describes the image.

### 1.2.1 Audio-only and Video-only (Prerecorded)

Level A · since WCAG 2.0 · [Understanding 1.2.1](https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded.html)

<!-- manual:start sc-1.2.1 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.2.1 -->

**Automated evidence (generated):**

- axe also has `audio-caption` (deprecated) for this criterion; axe leaves such rules out by default, so the suite does not run them.
- `UD-021` `V-VID-TRANSCRIPT`: The validator warns when a video has no transcript or text alternative. Runs in `npm test`: [`apps/server/test/validation/rules/videoTranscriptRule.test.ts`](../../apps/server/test/validation/rules/videoTranscriptRule.test.ts) (1 test title).

**Manual protocol:** no step names this criterion yet.

**Scope note:** Media and their alternatives in an activity are authored content: the author supplies them.

### 1.2.2 Captions (Prerecorded)

Level A · since WCAG 2.0 · [Understanding 1.2.2](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html)

<!-- manual:start sc-1.2.2 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.2.2 -->

**Automated evidence (generated):**

- axe [`video-caption`](https://dequeuniversity.com/rules/axe/4.13/video-caption). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: `video-caption` (critical): 4 elements in 4 scans.
- `UD-021` `V-VID-CAPTIONS`: The validator: an InteractiveVideo or Video without a text track, unless its Panopto source is listed as captioned, is an error. Runs in `npm test`: [`apps/server/test/validation/rules/videoCaptionsRule.test.ts`](../../apps/server/test/validation/rules/videoCaptionsRule.test.ts) (1 test title).

**Manual protocol:** no step names this criterion yet.

**Scope note:** Media and their alternatives in an activity are authored content: the author supplies them.

### 1.2.3 Audio Description or Media Alternative (Prerecorded)

Level A · since WCAG 2.0 · [Understanding 1.2.3](https://www.w3.org/WAI/WCAG22/Understanding/audio-description-or-media-alternative-prerecorded.html)

<!-- manual:start sc-1.2.3 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.2.3 -->

**Automated evidence (generated):**

- `UD-021` `V-VID-TRANSCRIPT`: The validator warns when a video has no transcript or text alternative. Runs in `npm test`: [`apps/server/test/validation/rules/videoTranscriptRule.test.ts`](../../apps/server/test/validation/rules/videoTranscriptRule.test.ts) (1 test title).

**Manual protocol:** no step names this criterion yet.

**Scope note:** Media and their alternatives in an activity are authored content: the author supplies them. Nothing checks audio description automatically.

### 1.2.4 Captions (Live)

Level AA · since WCAG 2.0 · [Understanding 1.2.4](https://www.w3.org/WAI/WCAG22/Understanding/captions-live.html)

<!-- manual:start sc-1.2.4 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.2.4 -->

**Automated evidence (generated):**

- None. No automated check covers this criterion; it rests on the manual evaluation.

**Manual protocol:** no step names this criterion yet.

### 1.2.5 Audio Description (Prerecorded)

Level AA · since WCAG 2.0 · [Understanding 1.2.5](https://www.w3.org/WAI/WCAG22/Understanding/audio-description-prerecorded.html)

<!-- manual:start sc-1.2.5 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.2.5 -->

**Automated evidence (generated):**

- None. No automated check covers this criterion; it rests on the manual evaluation.

**Manual protocol:** no step names this criterion yet.

**Scope note:** Media and their alternatives in an activity are authored content: the author supplies them. Nothing checks audio description automatically.

### 1.3.1 Info and Relationships

Level A · since WCAG 2.0 · [Understanding 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)

<!-- manual:start sc-1.3.1 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.3.1 -->

**Automated evidence (generated):**

- axe [`aria-hidden-body`](https://dequeuniversity.com/rules/axe/4.13/aria-hidden-body), [`aria-required-children`](https://dequeuniversity.com/rules/axe/4.13/aria-required-children), [`aria-required-parent`](https://dequeuniversity.com/rules/axe/4.13/aria-required-parent), [`definition-list`](https://dequeuniversity.com/rules/axe/4.13/definition-list), [`dlitem`](https://dequeuniversity.com/rules/axe/4.13/dlitem), [`list`](https://dequeuniversity.com/rules/axe/4.13/list), [`listitem`](https://dequeuniversity.com/rules/axe/4.13/listitem), [`td-headers-attr`](https://dequeuniversity.com/rules/axe/4.13/td-headers-attr), [`th-has-data-cells`](https://dequeuniversity.com/rules/axe/4.13/th-has-data-cells). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.
- axe also has `p-as-heading` (experimental), `table-fake-caption` (experimental), `td-has-header` (experimental) for this criterion; axe leaves such rules out by default, so the suite does not run them.
- `UD-021` `V-HEADING-ORDER`: The validator warns about rich-text headings that skip a level. Runs in `npm test`: [`apps/server/test/validation/rules/headingOrderRule.test.ts`](../../apps/server/test/validation/rules/headingOrderRule.test.ts) (2 test titles).
- `UD-021` `V-TABLE-HEADERS`: The validator warns about tables in activities without header cells. Runs in `npm test`: [`apps/server/test/validation/rules/tableHeadersRule.test.ts`](../../apps/server/test/validation/rules/tableHeadersRule.test.ts) (1 test title).
- `MAPPE-004`: The portfolio PDF is tagged: headings, paragraphs, lists and the table with header scopes, and an outline. Runs in `npm test`: [`apps/server/test/learningDesign/mappe/taggedPdf.browser.test.ts`](../../apps/server/test/learningDesign/mappe/taggedPdf.browser.test.ts) (4 test titles).

**Manual protocol:** J3.1 «Open **Innsikt → Før samlinga** for an activity.»; J4.2 «Open «Planleggar», choose the course and «Vis planen».»; J4.6 «In PAC's logical-structure view (or Acrobat's Tags pane), compare the tags with the Markdown file's headings.»; J4.9 «In the reader's guide, move through the table with NVDA's table commands (Ctrl+Alt+arrows).»; §7 Landmarks

### 1.3.2 Meaningful Sequence

Level A · since WCAG 2.0 · [Understanding 1.3.2](https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html)

<!-- manual:start sc-1.3.2 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.3.2 -->

**Automated evidence (generated):**

- `UD-021` `V-HOTSPOT-ORDER`: The validator warns when ImageHotspots’ hotspots are not ordered or a hotspot has no header. Runs in `npm test`: [`apps/server/test/validation/rules/hotspotOrderRule.test.ts`](../../apps/server/test/validation/rules/hotspotOrderRule.test.ts) (5 test titles).

**Manual protocol:** J1.11 «Open the short-video pattern (`/laeringsdesign/monster/fa-video`), read it, and under «Lag frå dette mønsteret» activate «Lag aktiviteten».»; J4.7 «Open the PDF in Adobe Acrobat Reader with NVDA and read it from the start with NVDA's say all.»

### 1.3.3 Sensory Characteristics

Level A · since WCAG 2.0 · [Understanding 1.3.3](https://www.w3.org/WAI/WCAG22/Understanding/sensory-characteristics.html)

<!-- manual:start sc-1.3.3 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.3.3 -->

**Automated evidence (generated):**

- `UD-021` `V-COLOUR-WORDS`: The validator hints at text that refers to colour alone. Runs in `npm test`: [`apps/server/test/validation/rules/colourWordsRule.test.ts`](../../apps/server/test/validation/rules/colourWordsRule.test.ts) (4 test titles).

**Manual protocol:** no step names this criterion yet.

### 1.3.4 Orientation

Level AA · since WCAG 2.1 · [Understanding 1.3.4](https://www.w3.org/WAI/WCAG22/Understanding/orientation.html)

<!-- manual:start sc-1.3.4 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.3.4 -->

**Automated evidence (generated):**

- axe also has `css-orientation-lock` (experimental) for this criterion; axe leaves such rules out by default, so the suite does not run them.
- `UD-008`, accessibility suite: Nothing scrolls sideways in either orientation: 320 × 640 and 640 × 320 CSS px. Views: the web app’s pages signed out and as the author, an activity’s «Spel», «Rediger» and «Sjekk og publiser» tabs, the Canvas page `/app/play` and the studio’s seeded pages; the player of each of the ten content types in Canvas, fresh and started and answered. Last run: 76 passed. Tests: [`apps/server/a11y/reflowAndMotion.a11y.test.ts`](../../apps/server/a11y/reflowAndMotion.a11y.test.ts) (3 test titles).

**Manual protocol:** J2.1 «Open the activity from the Canvas module.»

### 1.3.5 Identify Input Purpose

Level AA · since WCAG 2.1 · [Understanding 1.3.5](https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html)

<!-- manual:start sc-1.3.5 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.3.5 -->

**Automated evidence (generated):**

- axe [`autocomplete-valid`](https://dequeuniversity.com/rules/axe/4.13/autocomplete-valid). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.

**Manual protocol:** no step names this criterion yet.

**Scope note:** Sign-in goes through Feide or Canvas (UD-013); our own forms ask for no personal details.

### 1.4.1 Use of Color

Level A · since WCAG 2.0 · [Understanding 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)

<!-- manual:start sc-1.4.1 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.4.1 -->

**Automated evidence (generated):**

- axe [`link-in-text-block`](https://dequeuniversity.com/rules/axe/4.13/link-in-text-block). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.
- `UD-003`: Every right and wrong answer shows an icon and a text prefix (✓ Riktig: / ✗ Feil:) besides colour, drawn and in the accessibility tree, in the content types and inside containers; status badges likewise. Runs in `npm test`: [`apps/server/test/h5p/hvlFeedback.browser.int.test.ts`](../../apps/server/test/h5p/hvlFeedback.browser.int.test.ts) (5 test titles), [`apps/server/test/h5p/hvlFeedbackContainers.browser.int.test.ts`](../../apps/server/test/h5p/hvlFeedbackContainers.browser.int.test.ts) (3 test titles), [`apps/server/test/h5p/hvlFeedbackHotspot.browser.int.test.ts`](../../apps/server/test/h5p/hvlFeedbackHotspot.browser.int.test.ts) (2 test titles), [`apps/web/test/components/FindingsList.test.tsx`](../../apps/web/test/components/FindingsList.test.tsx) (1 test title), [`apps/web/test/components/StatusBadge.test.tsx`](../../apps/web/test/components/StatusBadge.test.tsx) (1 test title), [`apps/web/test/features/PlannerTable.test.tsx`](../../apps/web/test/features/PlannerTable.test.tsx) (2 test titles), [`apps/web/test/features/gradeSync/GradeSyncPanel.test.tsx`](../../apps/web/test/features/gradeSync/GradeSyncPanel.test.tsx) (1 test title), [`apps/web/test/features/gradeSync/GradeSyncPanelRetry.test.tsx`](../../apps/web/test/features/gradeSync/GradeSyncPanelRetry.test.tsx) (1 test title), [`apps/web/test/features/insight/InsightCharts.test.tsx`](../../apps/web/test/features/insight/InsightCharts.test.tsx) (1 test title), [`apps/web/test/features/insight/InsightFindings.test.tsx`](../../apps/web/test/features/insight/InsightFindings.test.tsx) (1 test title), [`apps/web/test/features/insight/InsightMisconceptions.test.tsx`](../../apps/web/test/features/insight/InsightMisconceptions.test.tsx) (1 test title), [`packages/design-tokens/test/contrast.test.ts`](../../packages/design-tokens/test/contrast.test.ts) (1 test title), [`packages/hvl-h5p-theme/test/feedbackNames.test.ts`](../../packages/hvl-h5p-theme/test/feedbackNames.test.ts) (6 test titles), [`packages/hvl-h5p-theme/test/feedbackPrefixes.test.ts`](../../packages/hvl-h5p-theme/test/feedbackPrefixes.test.ts) (6 test titles), [`packages/hvl-h5p-theme/test/feedbackPrefixesCss.test.ts`](../../packages/hvl-h5p-theme/test/feedbackPrefixesCss.test.ts) (10 test titles).
- `UD-021` `V-BRANCH-COLOUR`: The validator warns when a BranchingScenario choice relies on colour coding without text. Runs in `npm test`: [`apps/server/test/validation/rules/branchColourRule.test.ts`](../../apps/server/test/validation/rules/branchColourRule.test.ts) (3 test titles).
- `UD-021` `V-COLOUR-WORDS`: The validator hints at text that refers to colour alone. Runs in `npm test`: [`apps/server/test/validation/rules/colourWordsRule.test.ts`](../../apps/server/test/validation/rules/colourWordsRule.test.ts) (4 test titles).

**Manual protocol:** J2.3 «Check the answer («Sjekk»).»; J4.2 «Open «Planleggar», choose the course and «Vis planen».»; §7 Greyscale (KB, Z400)

### 1.4.2 Audio Control

Level A · since WCAG 2.0 · [Understanding 1.4.2](https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html)

<!-- manual:start sc-1.4.2 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.4.2 -->

**Automated evidence (generated):**

- axe [`no-autoplay-audio`](https://dequeuniversity.com/rules/axe/4.13/no-autoplay-audio). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.

**Manual protocol:** no step names this criterion yet.

### 1.4.3 Contrast (Minimum)

Level AA · since WCAG 2.0 · [Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

<!-- manual:start sc-1.4.3 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.4.3 -->

**Automated evidence (generated):**

- axe [`color-contrast`](https://dequeuniversity.com/rules/axe/4.13/color-contrast). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: `color-contrast` (serious): 2 elements in 2 scans; lower impact: none; left to review by hand: `color-contrast` (serious): 709 elements in 109 scans.
- `UD-001`: Every foreground and background pairing of the design tokens is computed (≥ 4.5 : 1 for text, 3 : 1 for large text). Runs in `npm test`: [`packages/design-tokens/test/contrast.test.ts`](../../packages/design-tokens/test/contrast.test.ts) (7 test titles).
- `UD-011`: H5P Core 1.28’s Daylight colours point at the HVL tokens and pass with them. Runs in `npm test`: [`packages/design-tokens/test/buildTokens.test.ts`](../../packages/design-tokens/test/buildTokens.test.ts) (1 test title), [`packages/design-tokens/test/contrast.test.ts`](../../packages/design-tokens/test/contrast.test.ts) (1 test title).

**Manual protocol:** no step names this criterion yet.

**Known H5P upstream barriers (register):**

- `color-contrast` in the editor of H5P.BranchingScenario: the "Paste" item is disabled by a class only (no aria-disabled), so its text, faded by `opacity: .5` (3.99:1; 3.94:1 under forced colours, which keep the opacity), counts as the text of an active control and assistive technology does not hear that it is unavailable (while the guided tour is open the reuse panel is faded and inert, so it is reported after the tour only). Source: <https://github.com/h5p/h5p-editor-branching-scenario/tree/8fcd92d0a5a5f6b855d9d03ce4d19ab31baa4b99>. Issue: not filed yet (D-112).

### 1.4.4 Resize Text

Level AA · since WCAG 2.0 · [Understanding 1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)

<!-- manual:start sc-1.4.4 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.4.4 -->

**Automated evidence (generated):**

- axe [`meta-viewport`](https://dequeuniversity.com/rules/axe/4.13/meta-viewport). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.
- `UD-002`, accessibility suite: At 200 % zoom no text is clipped and nothing scrolls sideways. Views: the web app’s pages signed out and as the author, an activity’s «Spel», «Rediger» and «Sjekk og publiser» tabs, the Canvas page `/app/play` and the studio’s seeded pages; the player of each of the ten content types in Canvas, fresh and started and answered. Last run: 39 passed. Tests: [`apps/server/a11y/textSpacingZoom.a11y.test.ts`](../../apps/server/a11y/textSpacingZoom.a11y.test.ts) (1 test title).
- `UD-002`: Style rules and theme: no font size in px, the HVL typeface and line height in the web app, the server pages and H5P. Runs in `npm test`: [`apps/server/test/http/pages/serverPages.browser.test.ts`](../../apps/server/test/http/pages/serverPages.browser.test.ts) (1 test title), [`packages/design-tokens/test/styleRules.test.ts`](../../packages/design-tokens/test/styleRules.test.ts) (1 test title), [`packages/design-tokens/test/tailwindTheme.test.ts`](../../packages/design-tokens/test/tailwindTheme.test.ts) (1 test title), [`packages/hvl-h5p-theme/test/themeStructure.test.ts`](../../packages/hvl-h5p-theme/test/themeStructure.test.ts) (1 test title).

**Manual protocol:** §7 400 % zoom (Z400)

### 1.4.5 Images of Text

Level AA · since WCAG 2.0 · [Understanding 1.4.5](https://www.w3.org/WAI/WCAG22/Understanding/images-of-text.html)

<!-- manual:start sc-1.4.5 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.4.5 -->

**Automated evidence (generated):**

- None. No automated check covers this criterion; it rests on the manual evaluation.

**Manual protocol:** no step names this criterion yet.

### 1.4.10 Reflow

Level AA · since WCAG 2.1 · [Understanding 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

<!-- manual:start sc-1.4.10 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.4.10 -->

**Automated evidence (generated):**

- `UD-008`, accessibility suite: Nothing scrolls sideways at 320 CSS px wide (except an ImageHotspots image, which may pan, and the editor’s score-range table, which scrolls in its own box). Views: the web app’s pages signed out and as the author, an activity’s «Spel», «Rediger» and «Sjekk og publiser» tabs, the Canvas page `/app/play` and the studio’s seeded pages; the player of each of the ten content types in Canvas, fresh and started and answered. Last run: 76 passed. Tests: [`apps/server/a11y/reflowAndMotion.a11y.test.ts`](../../apps/server/a11y/reflowAndMotion.a11y.test.ts) (3 test titles).

**Manual protocol:** J2.1 «Open the activity from the Canvas module.»; J4.2 «Open «Planleggar», choose the course and «Vis planen».»; §7 400 % zoom (Z400)

### 1.4.11 Non-text Contrast

Level AA · since WCAG 2.1 · [Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

<!-- manual:start sc-1.4.11 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.4.11 -->

**Automated evidence (generated):**

- `UD-001`: Non-text token pairings are at least 3 : 1. Runs in `npm test`: [`packages/design-tokens/test/contrast.test.ts`](../../packages/design-tokens/test/contrast.test.ts) (7 test titles).
- `UD-004`: The two-tone focus ring (#004357 outside, white inside) in the web app and in H5P. Runs in `npm test`: [`apps/server/test/h5p/hvlTheme.browser.int.test.ts`](../../apps/server/test/h5p/hvlTheme.browser.int.test.ts) (1 test title), [`packages/design-tokens/test/buildTokens.test.ts`](../../packages/design-tokens/test/buildTokens.test.ts) (1 test title), [`packages/design-tokens/test/contrast.test.ts`](../../packages/design-tokens/test/contrast.test.ts) (1 test title), [`packages/hvl-h5p-theme/test/a11yRepairsTour.test.ts`](../../packages/hvl-h5p-theme/test/a11yRepairsTour.test.ts) (1 test title), [`packages/hvl-h5p-theme/test/themeStructure.test.ts`](../../packages/hvl-h5p-theme/test/themeStructure.test.ts) (1 test title).
- `UD-012`: Under forced colours, focus rings, tabs and feedback borders use system colours. Runs in `npm test`: [`apps/server/test/h5p/hvlFeedbackHotspot.browser.int.test.ts`](../../apps/server/test/h5p/hvlFeedbackHotspot.browser.int.test.ts) (1 test title), [`apps/server/test/h5p/hvlTheme.browser.int.test.ts`](../../apps/server/test/h5p/hvlTheme.browser.int.test.ts) (1 test title), [`apps/server/test/h5p/hvlThemeIndicators.browser.int.test.ts`](../../apps/server/test/h5p/hvlThemeIndicators.browser.int.test.ts) (1 test title), [`apps/server/test/web/webChrome.browser.int.test.ts`](../../apps/server/test/web/webChrome.browser.int.test.ts) (1 test title), [`packages/design-tokens/test/buildTokens.test.ts`](../../packages/design-tokens/test/buildTokens.test.ts) (1 test title), [`packages/hvl-h5p-theme/test/themeStructure.test.ts`](../../packages/hvl-h5p-theme/test/themeStructure.test.ts) (2 test titles).

**Manual protocol:** §7 Forced colours

### 1.4.12 Text Spacing

Level AA · since WCAG 2.1 · [Understanding 1.4.12](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)

<!-- manual:start sc-1.4.12 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.4.12 -->

**Automated evidence (generated):**

- axe [`avoid-inline-spacing`](https://dequeuniversity.com/rules/axe/4.13/avoid-inline-spacing). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.
- `UD-002`, accessibility suite: With the 1.4.12 text-spacing styles applied, no text is clipped. Views: the web app’s pages signed out and as the author, an activity’s «Spel», «Rediger» and «Sjekk og publiser» tabs, the Canvas page `/app/play` and the studio’s seeded pages; the player of each of the ten content types in Canvas, fresh and started and answered. Last run: 38 passed. Tests: [`apps/server/a11y/textSpacingZoom.a11y.test.ts`](../../apps/server/a11y/textSpacingZoom.a11y.test.ts) (1 test title).

**Manual protocol:** §7 Text spacing

### 1.4.13 Content on Hover or Focus

Level AA · since WCAG 2.1 · [Understanding 1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)

<!-- manual:start sc-1.4.13 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-1.4.13 -->

**Automated evidence (generated):**

- None. No automated check covers this criterion; it rests on the manual evaluation.

**Manual protocol:** no step names this criterion yet.

**Scope note:** No automated check opens content on hover or focus in the web app’s pages signed out and as the author, an activity’s «Spel», «Rediger» and «Sjekk og publiser» tabs, the Canvas page `/app/play` and the studio’s seeded pages or the player of each of the ten content types in Canvas, fresh and started and answered.

## 7. Operable

### 2.1.1 Keyboard

Level A · since WCAG 2.0 · [Understanding 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)

<!-- manual:start sc-2.1.1 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.1.1 -->

**Automated evidence (generated):**

- axe [`frame-focusable-content`](https://dequeuniversity.com/rules/axe/4.13/frame-focusable-content), [`scrollable-region-focusable`](https://dequeuniversity.com/rules/axe/4.13/scrollable-region-focusable), [`server-side-image-map`](https://dequeuniversity.com/rules/axe/4.13/server-side-image-map). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.
- `UD-006`, accessibility suite: Journeys J1 and J2 by keyboard alone: an activity picked in the Deep Linking picker, the tabs, the publish dialog, a MultiChoice answer in Canvas and the formative notice. Views: the Deep Linking picker in Canvas, an activity page and `/app/play` with H5P.MultiChoice. Last run: 5 passed. Tests: [`apps/server/a11y/keyboardJourneys.a11y.test.ts`](../../apps/server/a11y/keyboardJourneys.a11y.test.ts) (5 test titles).
- `UD-006`, accessibility suite: The studio by keyboard: the catalogue filters, the planner table and its links, adding and leaving as co-author, and the portfolio picker with its download. Views: the studio’s catalogue, planner, an activity’s Deling tab and `/mappe`. Last run: 6 passed. Tests: [`apps/server/a11y/keyboardStudioJourneys.a11y.test.ts`](../../apps/server/a11y/keyboardStudioJourneys.a11y.test.ts) (6 test titles).
- `UD-006`, accessibility suite: The retry on «Poeng til Canvas» by keyboard. Views: an activity page in the portal. Last run: 1 passed. Tests: [`apps/server/a11y/axeGradeSync.a11y.test.ts`](../../apps/server/a11y/axeGradeSync.a11y.test.ts) (1 test title).
- `UD-006`, accessibility suite: The «Ta opp i samlinga» list on «Innsikt» by keyboard. Views: an activity page in the portal. Last run: 1 passed. Tests: [`apps/server/a11y/axeInsight.a11y.test.ts`](../../apps/server/a11y/axeInsight.a11y.test.ts) (1 test title).
- `UD-006`: Component and browser tests of the tabs, the dialogs, the focus moves and the editor’s «Gå til feltet». Runs in `npm test`: [`apps/server/test/h5p/a11yRepairs.browser.int.test.ts`](../../apps/server/test/h5p/a11yRepairs.browser.int.test.ts) (4 test titles), [`apps/server/test/h5p/branchingTour.browser.int.test.ts`](../../apps/server/test/h5p/branchingTour.browser.int.test.ts) (2 test titles), [`apps/server/test/h5p/editorGoToField.browser.int.test.ts`](../../apps/server/test/h5p/editorGoToField.browser.int.test.ts) (2 test titles), [`apps/server/test/h5p/editorGoToTitle.browser.int.test.ts`](../../apps/server/test/h5p/editorGoToTitle.browser.int.test.ts) (2 test titles), [`apps/server/test/h5p/render/editorFieldChain.test.ts`](../../apps/server/test/h5p/render/editorFieldChain.test.ts) (3 test titles), [`apps/server/test/h5p/render/editorFieldsScript.test.ts`](../../apps/server/test/h5p/render/editorFieldsScript.test.ts) (5 test titles), [`apps/server/test/h5p/render/editorSaveChoiceScript.test.ts`](../../apps/server/test/h5p/render/editorSaveChoiceScript.test.ts) (1 test title), [`apps/server/test/h5p/render/editorStartScript.test.ts`](../../apps/server/test/h5p/render/editorStartScript.test.ts) (1 test title), [`apps/server/test/h5p/render/editorTitleField.test.ts`](../../apps/server/test/h5p/render/editorTitleField.test.ts) (4 test titles), [`apps/server/test/http/pages/serverPages.browser.test.ts`](../../apps/server/test/http/pages/serverPages.browser.test.ts) (1 test title), [`apps/server/test/learningDesign/safeEditing/saveChoiceKeyboard.browser.int.test.ts`](../../apps/server/test/learningDesign/safeEditing/saveChoiceKeyboard.browser.int.test.ts) (3 test titles), [`apps/web/test/appStructure.test.ts`](../../apps/web/test/appStructure.test.ts) (2 test titles), [`apps/web/test/components/Dialog.test.tsx`](../../apps/web/test/components/Dialog.test.tsx) (4 test titles), [`apps/web/test/components/H5pFrame.test.tsx`](../../apps/web/test/components/H5pFrame.test.tsx) (1 test title), [`apps/web/test/components/Notice.test.tsx`](../../apps/web/test/components/Notice.test.tsx) (1 test title), [`apps/web/test/components/SiteHeader.test.tsx`](../../apps/web/test/components/SiteHeader.test.tsx) (1 test title), [`apps/web/test/components/StudioNav.test.tsx`](../../apps/web/test/components/StudioNav.test.tsx) (3 test titles), [`apps/web/test/components/Tabs.test.tsx`](../../apps/web/test/components/Tabs.test.tsx) (3 test titles), [`apps/web/test/components/useAnnouncement.test.tsx`](../../apps/web/test/components/useAnnouncement.test.tsx) (1 test title), [`apps/web/test/components/useFocusAfterChange.test.tsx`](../../apps/web/test/components/useFocusAfterChange.test.tsx) (6 test titles), [`apps/web/test/features/ActivitySaveChoice.test.tsx`](../../apps/web/test/features/ActivitySaveChoice.test.tsx) (3 test titles), [`apps/web/test/features/BankListingSection.test.tsx`](../../apps/web/test/features/BankListingSection.test.tsx) (2 test titles), [`apps/web/test/features/BankView.test.tsx`](../../apps/web/test/features/BankView.test.tsx) (1 test title), [`apps/web/test/features/CatalogueArrival.test.tsx`](../../apps/web/test/features/CatalogueArrival.test.tsx) (3 test titles), [`apps/web/test/features/CheckPanelFocus.test.tsx`](../../apps/web/test/features/CheckPanelFocus.test.tsx) (2 test titles), [`apps/web/test/features/CheckPanelTransitions.test.tsx`](../../apps/web/test/features/CheckPanelTransitions.test.tsx) (1 test title), [`apps/web/test/features/CoAuthorSection.test.tsx`](../../apps/web/test/features/CoAuthorSection.test.tsx) (1 test title), [`apps/web/test/features/LearningDesignPrompt.test.tsx`](../../apps/web/test/features/LearningDesignPrompt.test.tsx) (1 test title), [`apps/web/test/features/OutcomeFields.test.tsx`](../../apps/web/test/features/OutcomeFields.test.tsx) (2 test titles), [`apps/web/test/features/SharingPanel.test.tsx`](../../apps/web/test/features/SharingPanel.test.tsx) (1 test title), [`apps/web/test/features/UsedOutcomeChoices.test.tsx`](../../apps/web/test/features/UsedOutcomeChoices.test.tsx) (1 test title), [`apps/web/test/features/activityTabProps.test.tsx`](../../apps/web/test/features/activityTabProps.test.tsx) (1 test title), [`apps/web/test/features/activityTabs.test.tsx`](../../apps/web/test/features/activityTabs.test.tsx) (3 test titles), [`apps/web/test/features/gradeSync/GradeSyncPanel.test.tsx`](../../apps/web/test/features/gradeSync/GradeSyncPanel.test.tsx) (1 test title), [`apps/web/test/features/gradeSync/GradeSyncPanelRetry.test.tsx`](../../apps/web/test/features/gradeSync/GradeSyncPanelRetry.test.tsx) (1 test title), [`apps/web/test/features/gradeSync/gradeSyncTexts.test.ts`](../../apps/web/test/features/gradeSync/gradeSyncTexts.test.ts) (1 test title), [`apps/web/test/features/insight/InsightShortlist.test.tsx`](../../apps/web/test/features/insight/InsightShortlist.test.tsx) (3 test titles), [`apps/web/test/features/sharingFocusRace.test.tsx`](../../apps/web/test/features/sharingFocusRace.test.tsx) (3 test titles), [`apps/web/test/messaging/inertOutside.test.ts`](../../apps/web/test/messaging/inertOutside.test.ts) (3 test titles).

**Manual protocol:** J1.5 «Use the tabs «Spel», «Rediger», «Sjekk og publiser».»; J1.8 «Activate «Publiser».»; J1.13 «Open the published MultiChoice with a student's progress (§4), add an answer option in «Rediger» and activate «Lagre».»; J2.6 «Complete the activity with the keyboard only (KB) and with NVDA (AT-1).»; J3.3 «Add a question to the *Bring to seminar* shortlist.»; J4.1 «On an activity's «Læringsdesign» tab, set the phase, the course code, two learning outcomes with their category, a rationale, the minutes and the purpose; remove an outcome; save with «Lagre læringsdesignet».»

**Scope note:** D-080 records three barriers in the H5P editor that axe cannot see (protocol §8): QuestionSet’s editor-mode switch does not work by keyboard, the vertical-tab buttons open with Space only, and the hotspot position picker of ImageHotspots needs a pointer.

### 2.1.2 No Keyboard Trap

Level A · since WCAG 2.0 · [Understanding 2.1.2](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html)

<!-- manual:start sc-2.1.2 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.1.2 -->

**Automated evidence (generated):**

- `UD-004`, accessibility suite: Tab is pressed through every page and its frames until focus comes back to the start or leaves the page; a stop that holds focus for three presses, or a cycle that never returns, fails. Views: the web app’s pages signed out and as the author, an activity’s «Spel», «Rediger» and «Sjekk og publiser» tabs, the Canvas page `/app/play` and the studio’s seeded pages; the player of each of the ten content types in Canvas. Last run: 30 passed. Tests: [`apps/server/a11y/keyboardFocus.a11y.test.ts`](../../apps/server/a11y/keyboardFocus.a11y.test.ts) (3 test titles).
- `UD-006`, accessibility suite: The publish dialog keeps focus inside and returns it on Escape. Views: an activity page. Last run: 1 passed. Tests: [`apps/server/a11y/keyboardJourneys.a11y.test.ts`](../../apps/server/a11y/keyboardJourneys.a11y.test.ts) (1 test title).

**Manual protocol:** J1.8 «Activate «Publiser».»; J1.13 «Open the published MultiChoice with a student's progress (§4), add an answer option in «Rediger» and activate «Lagre».»; J2.6 «Complete the activity with the keyboard only (KB) and with NVDA (AT-1).»

### 2.1.4 Character Key Shortcuts

Level A · since WCAG 2.1 · [Understanding 2.1.4](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html)

<!-- manual:start sc-2.1.4 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.1.4 -->

**Automated evidence (generated):**

- None. No automated check covers this criterion; it rests on the manual evaluation.

**Manual protocol:** no step names this criterion yet.

**Scope note:** No automated check looks for single-character shortcuts.

### 2.2.1 Timing Adjustable

Level A · since WCAG 2.0 · [Understanding 2.2.1](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)

<!-- manual:start sc-2.2.1 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.2.1 -->

**Automated evidence (generated):**

- axe [`meta-refresh`](https://dequeuniversity.com/rules/axe/4.13/meta-refresh). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.

**Manual protocol:** no step names this criterion yet.

### 2.2.2 Pause, Stop, Hide

Level A · since WCAG 2.0 · [Understanding 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)

<!-- manual:start sc-2.2.2 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.2.2 -->

**Automated evidence (generated):**

- axe [`blink`](https://dequeuniversity.com/rules/axe/4.13/blink), [`marquee`](https://dequeuniversity.com/rules/axe/4.13/marquee). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.
- `UD-009`, accessibility suite: With reduced motion emulated, no CSS animation or transition runs (a recorder in every frame logs each one). Views: the web app’s pages signed out and as the author, an activity’s «Spel», «Rediger» and «Sjekk og publiser» tabs, the Canvas page `/app/play` and the studio’s seeded pages; the player of each of the ten content types in Canvas, fresh and started and answered. Last run: 29 passed. Tests: [`apps/server/a11y/reflowAndMotion.a11y.test.ts`](../../apps/server/a11y/reflowAndMotion.a11y.test.ts) (2 test titles).
- `UD-009`: The HVL theme stops transitions inside H5P under reduced motion. Runs in `npm test`: [`apps/server/test/h5p/hvlTheme.browser.int.test.ts`](../../apps/server/test/h5p/hvlTheme.browser.int.test.ts) (2 test titles).

**Manual protocol:** §7 Reduced motion

### 2.3.1 Three Flashes or Below Threshold

Level A · since WCAG 2.0 · [Understanding 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)

<!-- manual:start sc-2.3.1 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.3.1 -->

**Automated evidence (generated):**

- None. No automated check covers this criterion; it rests on the manual evaluation.

**Manual protocol:** §7 Reduced motion

**Scope note:** No automated check counts flashes; UD-009 forbids anything that flashes more than three times a second.

### 2.4.1 Bypass Blocks

Level A · since WCAG 2.0 · [Understanding 2.4.1](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html)

<!-- manual:start sc-2.4.1 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.4.1 -->

**Automated evidence (generated):**

- axe [`bypass`](https://dequeuniversity.com/rules/axe/4.13/bypass). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.
- `UD-006`, accessibility suite: The first Tab reaches the skip link «Gå til hovudinnhaldet», which moves focus to `main`. Views: the web app’s pages signed out and as the author, an activity’s «Spel», «Rediger» and «Sjekk og publiser» tabs, the Canvas page `/app/play` and the studio’s seeded pages. Last run: 16 passed. Tests: [`apps/server/a11y/keyboardFocus.a11y.test.ts`](../../apps/server/a11y/keyboardFocus.a11y.test.ts) (1 test title).
- `UD-006`: The skip link appears when focused. Runs in `npm test`: [`apps/server/test/http/pages/serverPages.browser.test.ts`](../../apps/server/test/http/pages/serverPages.browser.test.ts) (1 test title).

**Manual protocol:** J1.4 «Sign in to HVL Interaktiv with Feide and open the draft activity from «Aktivitetane dine».»; §7 Skip link

### 2.4.2 Page Titled

Level A · since WCAG 2.0 · [Understanding 2.4.2](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html)

<!-- manual:start sc-2.4.2 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.4.2 -->

**Automated evidence (generated):**

- axe [`document-title`](https://dequeuniversity.com/rules/axe/4.13/document-title). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.
- `UD-013`: Every route has its own title, its name first. Runs in `npm test`: [`apps/server/test/web/webChrome.browser.int.test.ts`](../../apps/server/test/web/webChrome.browser.int.test.ts) (1 test title).

**Manual protocol:** J1.4 «Sign in to HVL Interaktiv with Feide and open the draft activity from «Aktivitetane dine».»

### 2.4.3 Focus Order

Level A · since WCAG 2.0 · [Understanding 2.4.3](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)

<!-- manual:start sc-2.4.3 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.4.3 -->

**Automated evidence (generated):**

- `UD-006`, accessibility suite: Focus moves into the publish dialog and back to its opener, and stays in the formative notice’s panel. Views: an activity page. Last run: 2 passed. Tests: [`apps/server/a11y/keyboardJourneys.a11y.test.ts`](../../apps/server/a11y/keyboardJourneys.a11y.test.ts) (2 test titles).
- `UD-006`, accessibility suite: Focus after a filter, a link to the catalogue, adding or leaving as co-author and the portfolio picker. Views: the studio’s catalogue, planner, an activity’s Deling tab and `/mappe`. Last run: 6 passed. Tests: [`apps/server/a11y/keyboardStudioJourneys.a11y.test.ts`](../../apps/server/a11y/keyboardStudioJourneys.a11y.test.ts) (6 test titles).
- `UD-006`: Component tests of where focus goes after a change. Runs in `npm test`: [`apps/server/test/h5p/editorGoToField.browser.int.test.ts`](../../apps/server/test/h5p/editorGoToField.browser.int.test.ts) (1 test title), [`apps/server/test/h5p/editorGoToTitle.browser.int.test.ts`](../../apps/server/test/h5p/editorGoToTitle.browser.int.test.ts) (2 test titles), [`apps/server/test/h5p/render/editorFieldsScript.test.ts`](../../apps/server/test/h5p/render/editorFieldsScript.test.ts) (3 test titles), [`apps/server/test/h5p/render/editorTitleField.test.ts`](../../apps/server/test/h5p/render/editorTitleField.test.ts) (2 test titles), [`apps/server/test/http/pages/serverPages.browser.test.ts`](../../apps/server/test/http/pages/serverPages.browser.test.ts) (1 test title), [`apps/server/test/learningDesign/safeEditing/saveChoiceKeyboard.browser.int.test.ts`](../../apps/server/test/learningDesign/safeEditing/saveChoiceKeyboard.browser.int.test.ts) (2 test titles), [`apps/web/test/components/Dialog.test.tsx`](../../apps/web/test/components/Dialog.test.tsx) (2 test titles), [`apps/web/test/components/Notice.test.tsx`](../../apps/web/test/components/Notice.test.tsx) (1 test title), [`apps/web/test/components/Tabs.test.tsx`](../../apps/web/test/components/Tabs.test.tsx) (1 test title), [`apps/web/test/components/useFocusAfterChange.test.tsx`](../../apps/web/test/components/useFocusAfterChange.test.tsx) (1 test title), [`apps/web/test/features/BankListingSection.test.tsx`](../../apps/web/test/features/BankListingSection.test.tsx) (2 test titles), [`apps/web/test/features/CatalogueArrival.test.tsx`](../../apps/web/test/features/CatalogueArrival.test.tsx) (3 test titles), [`apps/web/test/features/CheckPanelFocus.test.tsx`](../../apps/web/test/features/CheckPanelFocus.test.tsx) (2 test titles), [`apps/web/test/features/CheckPanelTransitions.test.tsx`](../../apps/web/test/features/CheckPanelTransitions.test.tsx) (1 test title), [`apps/web/test/features/CoAuthorSection.test.tsx`](../../apps/web/test/features/CoAuthorSection.test.tsx) (1 test title), [`apps/web/test/features/LearningDesignPrompt.test.tsx`](../../apps/web/test/features/LearningDesignPrompt.test.tsx) (1 test title), [`apps/web/test/features/OutcomeFields.test.tsx`](../../apps/web/test/features/OutcomeFields.test.tsx) (2 test titles), [`apps/web/test/features/UsedOutcomeChoices.test.tsx`](../../apps/web/test/features/UsedOutcomeChoices.test.tsx) (1 test title), [`apps/web/test/features/gradeSync/GradeSyncPanelRetry.test.tsx`](../../apps/web/test/features/gradeSync/GradeSyncPanelRetry.test.tsx) (1 test title), [`apps/web/test/features/insight/InsightShortlist.test.tsx`](../../apps/web/test/features/insight/InsightShortlist.test.tsx) (2 test titles), [`apps/web/test/features/sharingFocusRace.test.tsx`](../../apps/web/test/features/sharingFocusRace.test.tsx) (3 test titles), [`apps/web/test/messaging/inertOutside.test.ts`](../../apps/web/test/messaging/inertOutside.test.ts) (1 test title).

**Manual protocol:** J1.3 «Choose a published activity and activate «Legg inn i Canvas».»; J1.8 «Activate «Publiser».»; J1.13 «Open the published MultiChoice with a student's progress (§4), add an answer option in «Rediger» and activate «Lagre».»; J4.1 «On an activity's «Læringsdesign» tab, set the phase, the course code, two learning outcomes with their category, a rationale, the minutes and the purpose; remove an outcome; save with «Lagre læringsdesignet».»

### 2.4.4 Link Purpose (In Context)

Level A · since WCAG 2.0 · [Understanding 2.4.4](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html)

<!-- manual:start sc-2.4.4 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.4.4 -->

**Automated evidence (generated):**

- axe [`area-alt`](https://dequeuniversity.com/rules/axe/4.13/area-alt), [`link-name`](https://dequeuniversity.com/rules/axe/4.13/link-name). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.
- `UD-021` `V-LINK-TEXT`: The validator warns about link texts such as «klikk her», «her», «les meir» or a bare URL. Runs in `npm test`: [`apps/server/test/validation/rules/linkTextRule.test.ts`](../../apps/server/test/validation/rules/linkTextRule.test.ts) (2 test titles).
- `UD-007`: External links say that they leave the site; file links name their type and size. Runs in `npm test`: [`apps/server/test/http/pages/htmlPage.test.ts`](../../apps/server/test/http/pages/htmlPage.test.ts) (1 test title), [`apps/web/test/components/ExternalLink.test.tsx`](../../apps/web/test/components/ExternalLink.test.tsx) (3 test titles), [`apps/web/test/components/FileLink.test.tsx`](../../apps/web/test/components/FileLink.test.tsx) (2 test titles), [`apps/web/test/components/SiteHeader.test.tsx`](../../apps/web/test/components/SiteHeader.test.tsx) (1 test title).

**Manual protocol:** J4.2 «Open «Planleggar», choose the course and «Vis planen».»

### 2.4.5 Multiple Ways

Level AA · since WCAG 2.0 · [Understanding 2.4.5](https://www.w3.org/WAI/WCAG22/Understanding/multiple-ways.html)

<!-- manual:start sc-2.4.5 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.4.5 -->

**Automated evidence (generated):**

- None. No automated check covers this criterion; it rests on the manual evaluation.

**Manual protocol:** no step names this criterion yet.

### 2.4.6 Headings and Labels

Level AA · since WCAG 2.0 · [Understanding 2.4.6](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html)

<!-- manual:start sc-2.4.6 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.4.6 -->

**Automated evidence (generated):**

- None. No automated check covers this criterion; it rests on the manual evaluation.

**Manual protocol:** J1.4 «Sign in to HVL Interaktiv with Feide and open the draft activity from «Aktivitetane dine».»; J1.6 «In «Rediger», change the question text and save («Lagre»).»; J3.1 «Open **Innsikt → Før samlinga** for an activity.»; J4.1 «On an activity's «Læringsdesign» tab, set the phase, the course code, two learning outcomes with their category, a rationale, the minutes and the purpose; remove an outcome; save with «Lagre læringsdesignet».»

### 2.4.7 Focus Visible

Level AA · since WCAG 2.0 · [Understanding 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)

<!-- manual:start sc-2.4.7 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.4.7 -->

**Automated evidence (generated):**

- `UD-004`, accessibility suite: Every element that takes focus from the keyboard shows a ring that differs from its unfocused look. Views: the web app’s pages signed out and as the author, an activity’s «Spel», «Rediger» and «Sjekk og publiser» tabs, the Canvas page `/app/play` and the studio’s seeded pages; the player of each of the ten content types in Canvas. Last run: 30 passed. Tests: [`apps/server/a11y/keyboardFocus.a11y.test.ts`](../../apps/server/a11y/keyboardFocus.a11y.test.ts) (3 test titles).
- `UD-004`: The two-tone focus ring (#004357 outside, white inside) in the web app and in H5P. Runs in `npm test`: [`apps/server/test/h5p/hvlTheme.browser.int.test.ts`](../../apps/server/test/h5p/hvlTheme.browser.int.test.ts) (1 test title), [`packages/design-tokens/test/buildTokens.test.ts`](../../packages/design-tokens/test/buildTokens.test.ts) (1 test title), [`packages/design-tokens/test/contrast.test.ts`](../../packages/design-tokens/test/contrast.test.ts) (1 test title), [`packages/hvl-h5p-theme/test/a11yRepairsTour.test.ts`](../../packages/hvl-h5p-theme/test/a11yRepairsTour.test.ts) (1 test title), [`packages/hvl-h5p-theme/test/themeStructure.test.ts`](../../packages/hvl-h5p-theme/test/themeStructure.test.ts) (1 test title).

**Manual protocol:** J2.6 «Complete the activity with the keyboard only (KB) and with NVDA (AT-1).»

### 2.4.11 Focus Not Obscured (Minimum)

Level AA · since WCAG 2.2 · [Understanding 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)

<!-- manual:start sc-2.4.11 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.4.11 -->

**Automated evidence (generated):**

- `UD-004`, accessibility suite: Every focused element is in the viewport and not covered by the header or anything else (`elementFromPoint`). Views: the web app’s pages signed out and as the author, an activity’s «Spel», «Rediger» and «Sjekk og publiser» tabs, the Canvas page `/app/play` and the studio’s seeded pages; the player of each of the ten content types in Canvas. Last run: 30 passed. Tests: [`apps/server/a11y/keyboardFocus.a11y.test.ts`](../../apps/server/a11y/keyboardFocus.a11y.test.ts) (3 test titles).

**Manual protocol:** J2.6 «Complete the activity with the keyboard only (KB) and with NVDA (AT-1).»

### 2.5.1 Pointer Gestures

Level A · since WCAG 2.1 · [Understanding 2.5.1](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html)

<!-- manual:start sc-2.5.1 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.5.1 -->

**Automated evidence (generated):**

- None. No automated check covers this criterion; it rests on the manual evaluation.

**Manual protocol:** no step names this criterion yet.

### 2.5.2 Pointer Cancellation

Level A · since WCAG 2.1 · [Understanding 2.5.2](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html)

<!-- manual:start sc-2.5.2 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.5.2 -->

**Automated evidence (generated):**

- None. No automated check covers this criterion; it rests on the manual evaluation.

**Manual protocol:** no step names this criterion yet.

### 2.5.3 Label in Name

Level A · since WCAG 2.1 · [Understanding 2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)

<!-- manual:start sc-2.5.3 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.5.3 -->

**Automated evidence (generated):**

- axe also has `label-content-name-mismatch` (experimental) for this criterion; axe leaves such rules out by default, so the suite does not run them.

**Manual protocol:** no step names this criterion yet.

### 2.5.4 Motion Actuation

Level A · since WCAG 2.1 · [Understanding 2.5.4](https://www.w3.org/WAI/WCAG22/Understanding/motion-actuation.html)

<!-- manual:start sc-2.5.4 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.5.4 -->

**Automated evidence (generated):**

- None. No automated check covers this criterion; it rests on the manual evaluation.

**Manual protocol:** no step names this criterion yet.

### 2.5.7 Dragging Movements

Level AA · since WCAG 2.2 · [Understanding 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)

<!-- manual:start sc-2.5.7 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.5.7 -->

**Automated evidence (generated):**

- `UD-006`: DragText: a word dropped by keyboard lands in a named drop zone. Runs in `npm test`: [`apps/server/test/h5p/a11yRepairs.browser.int.test.ts`](../../apps/server/test/h5p/a11yRepairs.browser.int.test.ts) (1 test title).

**Manual protocol:** J2.6 «Complete the activity with the keyboard only (KB) and with NVDA (AT-1).»

**Scope note:** H5P.DragQuestion, which has no single-pointer alternative, is never offered (H5P-002); DragText’s keyboard and click mode is the alternative UD-005 names.

### 2.5.8 Target Size (Minimum)

Level AA · since WCAG 2.2 · [Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

<!-- manual:start sc-2.5.8 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-2.5.8 -->

**Automated evidence (generated):**

- axe [`target-size`](https://dequeuniversity.com/rules/axe/4.13/target-size). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.
- `UD-005`, accessibility suite: Every pointer target of the page and its frames is at least 24 × 24 CSS px, or one of the exceptions of WCAG 2.5.8 (inline, spacing, equivalent, essential). Views: the web app’s pages signed out and as the author, an activity’s «Spel», «Rediger» and «Sjekk og publiser» tabs, the Canvas page `/app/play` and the studio’s seeded pages; the player of each of the ten content types in Canvas, fresh and started and answered. Last run: 31 passed. Tests: [`apps/server/a11y/targetSize.a11y.test.ts`](../../apps/server/a11y/targetSize.a11y.test.ts) (3 test titles).
- `UD-005`, accessibility suite: At 320, 390 and 640 CSS px a pointer can press all of every footer control of CoursePresentation. Views: H5P.CoursePresentation in Canvas. Last run: 6 passed. Tests: [`apps/server/a11y/reflowAndMotion.a11y.test.ts`](../../apps/server/a11y/reflowAndMotion.a11y.test.ts) (1 test title).
- `UD-005`: Style rules: the theme and the web app give every control a 24 px minimum. Runs in `npm test`: [`packages/design-tokens/test/tailwindTheme.test.ts`](../../packages/design-tokens/test/tailwindTheme.test.ts) (1 test title), [`packages/hvl-h5p-theme/test/themeStructure.test.ts`](../../packages/hvl-h5p-theme/test/themeStructure.test.ts) (2 test titles).

**Manual protocol:** no step names this criterion yet.

**Scope note:** CoursePresentation’s progress bar in full screen is H5P’s own, with parts smaller than 24 px; D-080 relies on the side menu and the previous and next buttons as the equivalent controls (protocol §8).

## 8. Understandable

### 3.1.1 Language of Page

Level A · since WCAG 2.0 · [Understanding 3.1.1](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html)

<!-- manual:start sc-3.1.1 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-3.1.1 -->

**Automated evidence (generated):**

- axe [`html-has-lang`](https://dequeuniversity.com/rules/axe/4.13/html-has-lang), [`html-lang-valid`](https://dequeuniversity.com/rules/axe/4.13/html-lang-valid), [`html-xml-lang-mismatch`](https://dequeuniversity.com/rules/axe/4.13/html-xml-lang-mismatch). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.
- `UD-010`, accessibility suite: Every page has `<html lang="nn">` for an author with the default locale. Views: the web app’s pages signed out and as the author, an activity’s «Spel», «Rediger» and «Sjekk og publiser» tabs, the Canvas page `/app/play` and the studio’s seeded pages. Last run: 19 passed. Tests: [`apps/server/a11y/language.a11y.test.ts`](../../apps/server/a11y/language.a11y.test.ts) (1 test title).
- `UD-010`: The page language follows the locale Express decides, not the client. Runs in `npm test`: [`apps/server/test/h5p/render/editorPage.test.ts`](../../apps/server/test/h5p/render/editorPage.test.ts) (1 test title), [`apps/server/test/web/webApp.browser.int.test.ts`](../../apps/server/test/web/webApp.browser.int.test.ts) (1 test title), [`apps/web/test/i18n/translate.test.ts`](../../apps/web/test/i18n/translate.test.ts) (1 test title).

**Manual protocol:** J2.1 «Open the activity from the Canvas module.»

### 3.1.2 Language of Parts

Level AA · since WCAG 2.0 · [Understanding 3.1.2](https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html)

<!-- manual:start sc-3.1.2 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-3.1.2 -->

**Automated evidence (generated):**

- axe [`valid-lang`](https://dequeuniversity.com/rules/axe/4.13/valid-lang). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: none.
- `UD-010`, accessibility suite: The player’s content container and the editor’s frame carry the activity’s language. Views: the player and the editor of each of the ten content types. Last run: 10 passed. Tests: [`apps/server/a11y/language.a11y.test.ts`](../../apps/server/a11y/language.a11y.test.ts) (1 test title).
- `UD-010`, accessibility suite: A reference, a learner purpose or a source title in another language than the page carries its own lang. Views: the guide page, an activity’s learner purpose and a copy’s attribution sign. Last run: 3 passed. Tests: [`apps/server/a11y/language.a11y.test.ts`](../../apps/server/a11y/language.a11y.test.ts) (3 test titles).
- `UD-021` `V-LANG`: The validator warns when an activity does not state its language. Runs in `npm test`: [`apps/server/test/validation/rules/languageRule.test.ts`](../../apps/server/test/validation/rules/languageRule.test.ts) (1 test title).
- `UD-010`: Server, component and theme tests of the lang of parts: the content container, titles, purposes, references and feedback prefixes. Runs in `npm test`: [`apps/server/test/h5p/hvlFeedback.browser.int.test.ts`](../../apps/server/test/h5p/hvlFeedback.browser.int.test.ts) (1 test title), [`apps/server/test/h5p/render/editorPage.test.ts`](../../apps/server/test/h5p/render/editorPage.test.ts) (1 test title), [`apps/server/test/h5p/render/playerPage.test.ts`](../../apps/server/test/h5p/render/playerPage.test.ts) (1 test title), [`apps/server/test/http/api/contentListRoutes.int.test.ts`](../../apps/server/test/http/api/contentListRoutes.int.test.ts) (1 test title), [`apps/server/test/http/player.int.test.ts`](../../apps/server/test/http/player.int.test.ts) (1 test title), [`apps/server/test/learningDesign/content/referencesContent.test.ts`](../../apps/server/test/learningDesign/content/referencesContent.test.ts) (1 test title), [`apps/server/test/lti/appLaunch.int.test.ts`](../../apps/server/test/lti/appLaunch.int.test.ts) (1 test title), [`apps/server/test/lti/appLaunchLearnerInfo.int.test.ts`](../../apps/server/test/lti/appLaunchLearnerInfo.int.test.ts) (1 test title), [`apps/server/test/validation/activityLanguage.test.ts`](../../apps/server/test/validation/activityLanguage.test.ts) (1 test title), [`apps/server/test/web/webApp.browser.int.test.ts`](../../apps/server/test/web/webApp.browser.int.test.ts) (1 test title), [`apps/web/test/features/ActivityView.test.tsx`](../../apps/web/test/features/ActivityView.test.tsx) (1 test title), [`apps/web/test/features/GuideView.test.tsx`](../../apps/web/test/features/GuideView.test.tsx) (1 test title), [`apps/web/test/features/LtiPlayView.test.tsx`](../../apps/web/test/features/LtiPlayView.test.tsx) (1 test title), [`apps/web/test/features/PortalHome.test.tsx`](../../apps/web/test/features/PortalHome.test.tsx) (1 test title), [`apps/web/test/features/SourceAttributionNote.test.tsx`](../../apps/web/test/features/SourceAttributionNote.test.tsx) (2 test titles), [`apps/web/test/features/learnerInfoViews.test.tsx`](../../apps/web/test/features/learnerInfoViews.test.tsx) (1 test title), [`apps/web/test/i18n/partLanguage.test.ts`](../../apps/web/test/i18n/partLanguage.test.ts) (1 test title), [`apps/web/test/lti/launchHeader.test.ts`](../../apps/web/test/lti/launchHeader.test.ts) (1 test title), [`packages/hvl-h5p-theme/test/feedbackNames.test.ts`](../../packages/hvl-h5p-theme/test/feedbackNames.test.ts) (1 test title), [`packages/hvl-h5p-theme/test/feedbackPrefixes.test.ts`](../../packages/hvl-h5p-theme/test/feedbackPrefixes.test.ts) (2 test titles).

**Manual protocol:** J1.11 «Open the short-video pattern (`/laeringsdesign/monster/fa-video`), read it, and under «Lag frå dette mønsteret» activate «Lag aktiviteten».»; J2.1 «Open the activity from the Canvas module.»; J4.7 «Open the PDF in Adobe Acrobat Reader with NVDA and read it from the start with NVDA's say all.»; J4.10 «Export the same activities in English and repeat J4.5 and J4.7.»

**Known H5P upstream barriers (register):**

- H5P.Video 1.6 writes «Video source is missing.» in English in every language (an InteractiveVideo (or another type holding an H5P.Video) has no video source): H5P.Video merges its English defaults over the l10n it is given ($.extend), so no translation reaches it; V-PLACEHOLDER reports the missing video as an error, so such an activity is not published by mistake. Source: <https://github.com/h5p/h5p-video/blob/af25aef6e9eb8f84db037d564d82494c7d44e267/scripts/video.js>. Issue: not filed yet (D-112).
- H5P.ImageHotspots 1.11 writes «Missing required background image» in English in every language (an ImageHotspots has no background image): the text is written into the markup in English and has no field in the semantics or language files; V-PLACEHOLDER reports the missing image as an error, so such an activity is not published by mistake. Source: <https://github.com/h5p/h5p-image-hotspots/blob/adc855f17f2c86e8741c9299f6d834f8fabc7417/scripts/image-hotspots.js>. Issue: not filed yet (D-112).

**Scope note:** The portfolio PDF gives activity titles and references no language of their own (D-096, D-094 amendment; protocol §6, J4).

### 3.2.1 On Focus

Level A · since WCAG 2.0 · [Understanding 3.2.1](https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html)

<!-- manual:start sc-3.2.1 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-3.2.1 -->

**Automated evidence (generated):**

- None. No automated check covers this criterion; it rests on the manual evaluation.

**Manual protocol:** no step names this criterion yet.

### 3.2.2 On Input

Level A · since WCAG 2.0 · [Understanding 3.2.2](https://www.w3.org/WAI/WCAG22/Understanding/on-input.html)

<!-- manual:start sc-3.2.2 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-3.2.2 -->

**Automated evidence (generated):**

- `UD-006` `PED-003`, accessibility suite: Choosing a filter in the catalogue keeps focus on the select and announces the count. Views: the studio’s pattern catalogue. Last run: 1 passed. Tests: [`apps/server/a11y/keyboardStudioJourneys.a11y.test.ts`](../../apps/server/a11y/keyboardStudioJourneys.a11y.test.ts) (1 test title).

**Manual protocol:** J1.10 «Open «Læringsdesign» in the main menu (`/laeringsdesign`). Move by headings to «Mønsterkatalogen» and set «Fase» to Forarbeid.»; J4.3 «Open «Mappe» (`/mappe`), filter by the course, choose the activities with «Vel alle som passar», and pick the criteria set and the language Nynorsk.»

### 3.2.3 Consistent Navigation

Level AA · since WCAG 2.0 · [Understanding 3.2.3](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html)

<!-- manual:start sc-3.2.3 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-3.2.3 -->

**Automated evidence (generated):**

- `UD-013`: The header orders the site name, the main menu and Hjelp the same way on every page. Runs in `npm test`: [`apps/web/test/components/SiteHeader.test.tsx`](../../apps/web/test/components/SiteHeader.test.tsx) (1 test title).

**Manual protocol:** no step names this criterion yet.

### 3.2.4 Consistent Identification

Level AA · since WCAG 2.0 · [Understanding 3.2.4](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)

<!-- manual:start sc-3.2.4 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-3.2.4 -->

**Automated evidence (generated):**

- None. No automated check covers this criterion; it rests on the manual evaluation.

**Manual protocol:** no step names this criterion yet.

### 3.2.6 Consistent Help

Level A · since WCAG 2.2 · [Understanding 3.2.6](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html)

<!-- manual:start sc-3.2.6 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-3.2.6 -->

**Automated evidence (generated):**

- `UD-013`: Hjelp is in the same place in the header of the portal, the server pages and Canvas. Runs in `npm test`: [`apps/server/test/http/pages/htmlPage.test.ts`](../../apps/server/test/http/pages/htmlPage.test.ts) (2 test titles), [`apps/server/test/http/pages/portalPages.test.ts`](../../apps/server/test/http/pages/portalPages.test.ts) (1 test title), [`apps/server/test/lti/appChrome.int.test.ts`](../../apps/server/test/lti/appChrome.int.test.ts) (1 test title), [`apps/server/test/lti/http/ltiErrorPages.test.ts`](../../apps/server/test/lti/http/ltiErrorPages.test.ts) (1 test title), [`apps/server/test/lti/pages/deepLinkPickerPage.test.ts`](../../apps/server/test/lti/pages/deepLinkPickerPage.test.ts) (1 test title), [`apps/web/test/components/SiteHeader.test.tsx`](../../apps/web/test/components/SiteHeader.test.tsx) (2 test titles).

**Manual protocol:** §7 Help link

### 3.3.1 Error Identification

Level A · since WCAG 2.0 · [Understanding 3.3.1](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html)

<!-- manual:start sc-3.3.1 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-3.3.1 -->

**Automated evidence (generated):**

- `UD-013`: Errors are listed in a summary at the top and linked to their fields. Runs in `npm test`: [`apps/server/test/lti/pages/deepLinkPicker.browser.test.ts`](../../apps/server/test/lti/pages/deepLinkPicker.browser.test.ts) (2 test titles), [`apps/server/test/lti/pages/deepLinkPickerPage.test.ts`](../../apps/server/test/lti/pages/deepLinkPickerPage.test.ts) (2 test titles), [`apps/web/test/components/PublishDialog.test.tsx`](../../apps/web/test/components/PublishDialog.test.tsx) (1 test title), [`apps/web/test/features/CreateFromPatternFocus.test.tsx`](../../apps/web/test/features/CreateFromPatternFocus.test.tsx) (1 test title), [`apps/web/test/features/LearningDesignPanel.test.tsx`](../../apps/web/test/features/LearningDesignPanel.test.tsx) (1 test title).

**Manual protocol:** J1.9 «Open it again; give a reason for each error if asked; activate «Publiser no».»; J4.1 «On an activity's «Læringsdesign» tab, set the phase, the course code, two learning outcomes with their category, a rationale, the minutes and the purpose; remove an outcome; save with «Lagre læringsdesignet».»

### 3.3.2 Labels or Instructions

Level A · since WCAG 2.0 · [Understanding 3.3.2](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)

<!-- manual:start sc-3.3.2 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-3.3.2 -->

**Automated evidence (generated):**

- axe [`form-field-multiple-labels`](https://dequeuniversity.com/rules/axe/4.13/form-field-multiple-labels). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: none; lower impact: none; left to review by hand: `form-field-multiple-labels` (moderate): 2 elements in 2 scans.

**Manual protocol:** J1.6 «In «Rediger», change the question text and save («Lagre»).»; J1.11 «Open the short-video pattern (`/laeringsdesign/monster/fa-video`), read it, and under «Lag frå dette mønsteret» activate «Lag aktiviteten».»; J4.1 «On an activity's «Læringsdesign» tab, set the phase, the course code, two learning outcomes with their category, a rationale, the minutes and the purpose; remove an outcome; save with «Lagre læringsdesignet».»; J4.3 «Open «Mappe» (`/mappe`), filter by the course, choose the activities with «Vel alle som passar», and pick the criteria set and the language Nynorsk.»

### 3.3.3 Error Suggestion

Level AA · since WCAG 2.0 · [Understanding 3.3.3](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html)

<!-- manual:start sc-3.3.3 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-3.3.3 -->

**Automated evidence (generated):**

- `UD-013`: A refused save or copy gives the server’s reason and says what to do. Runs in `npm test`: [`apps/server/test/h5p/render/blockedSaveTexts.test.ts`](../../apps/server/test/h5p/render/blockedSaveTexts.test.ts) (1 test title), [`apps/server/test/h5p/render/editorPageScript.test.ts`](../../apps/server/test/h5p/render/editorPageScript.test.ts) (1 test title), [`apps/server/test/h5p/render/editorSaveChoiceScript.test.ts`](../../apps/server/test/h5p/render/editorSaveChoiceScript.test.ts) (1 test title), [`apps/server/test/h5p/render/editorSaveRequests.test.ts`](../../apps/server/test/h5p/render/editorSaveRequests.test.ts) (1 test title).

**Manual protocol:** J1.9 «Open it again; give a reason for each error if asked; activate «Publiser no».»; J1.12 «In «Sjekk og publiser», read the errors and use «Gå til feltet» on one.»

### 3.3.4 Error Prevention (Legal, Financial, Data)

Level AA · since WCAG 2.0 · [Understanding 3.3.4](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html)

<!-- manual:start sc-3.3.4 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-3.3.4 -->

**Automated evidence (generated):**

- `UD-030`, accessibility suite: A change that would reset students’ progress opens a dialog first (PROD-013); axe scans it open. Views: an activity page with the dialog open. Last run: 2 passed. Tests: [`apps/server/a11y/axeSaveChoice.a11y.test.ts`](../../apps/server/a11y/axeSaveChoice.a11y.test.ts) (1 test title).

**Manual protocol:** J1.8 «Activate «Publiser».»; J1.13 «Open the published MultiChoice with a student's progress (§4), add an answer option in «Rediger» and activate «Lagre».»

### 3.3.7 Redundant Entry

Level A · since WCAG 2.2 · [Understanding 3.3.7](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html)

<!-- manual:start sc-3.3.7 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-3.3.7 -->

**Automated evidence (generated):**

- `UD-013`: Closing the publish dialog keeps the typed reasons for the next opening. Runs in `npm test`: [`apps/web/test/components/PublishDialog.test.tsx`](../../apps/web/test/components/PublishDialog.test.tsx) (1 test title).

**Manual protocol:** J1.9 «Open it again; give a reason for each error if asked; activate «Publiser no».»

### 3.3.8 Accessible Authentication (Minimum)

Level AA · since WCAG 2.2 · [Understanding 3.3.8](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html)

<!-- manual:start sc-3.3.8 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-3.3.8 -->

**Automated evidence (generated):**

- `UD-013`: The start page logs in through Feide. Runs in `npm test`: [`apps/web/test/components/LoginPrompt.test.tsx`](../../apps/web/test/components/LoginPrompt.test.tsx) (1 test title).

**Manual protocol:** no step names this criterion yet.

**Scope note:** Sign-in goes through Feide or Canvas only (UD-013); HVL Interaktiv adds no cognitive test of its own.

## 9. Robust

### 4.1.1 Parsing

Level A · since WCAG 2.0 · [Understanding 4.1.1](https://www.w3.org/WAI/WCAG22/Understanding/parsing.html)

<!-- manual:start sc-4.1.1 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-4.1.1 -->

**Automated evidence (generated):**

- axe also has `duplicate-id` (deprecated), `duplicate-id-active` (deprecated) for this criterion; axe leaves such rules out by default, so the suite does not run them.

**Manual protocol:** no step names this criterion yet.

**Scope note:** Obsolete in WCAG 2.2, where it is always satisfied; listed for WCAG 2.1 and EN 301 549.

### 4.1.2 Name, Role, Value

Level A · since WCAG 2.0 · [Understanding 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)

<!-- manual:start sc-4.1.2 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-4.1.2 -->

**Automated evidence (generated):**

- axe [`area-alt`](https://dequeuniversity.com/rules/axe/4.13/area-alt), [`aria-allowed-attr`](https://dequeuniversity.com/rules/axe/4.13/aria-allowed-attr), [`aria-braille-equivalent`](https://dequeuniversity.com/rules/axe/4.13/aria-braille-equivalent), [`aria-command-name`](https://dequeuniversity.com/rules/axe/4.13/aria-command-name), [`aria-conditional-attr`](https://dequeuniversity.com/rules/axe/4.13/aria-conditional-attr), [`aria-deprecated-role`](https://dequeuniversity.com/rules/axe/4.13/aria-deprecated-role), [`aria-hidden-body`](https://dequeuniversity.com/rules/axe/4.13/aria-hidden-body), [`aria-hidden-focus`](https://dequeuniversity.com/rules/axe/4.13/aria-hidden-focus), [`aria-input-field-name`](https://dequeuniversity.com/rules/axe/4.13/aria-input-field-name), [`aria-prohibited-attr`](https://dequeuniversity.com/rules/axe/4.13/aria-prohibited-attr), [`aria-required-attr`](https://dequeuniversity.com/rules/axe/4.13/aria-required-attr), [`aria-roles`](https://dequeuniversity.com/rules/axe/4.13/aria-roles), [`aria-tab-name`](https://dequeuniversity.com/rules/axe/4.13/aria-tab-name), [`aria-toggle-field-name`](https://dequeuniversity.com/rules/axe/4.13/aria-toggle-field-name), [`aria-tooltip-name`](https://dequeuniversity.com/rules/axe/4.13/aria-tooltip-name), [`aria-valid-attr`](https://dequeuniversity.com/rules/axe/4.13/aria-valid-attr), [`aria-valid-attr-value`](https://dequeuniversity.com/rules/axe/4.13/aria-valid-attr-value), [`button-name`](https://dequeuniversity.com/rules/axe/4.13/button-name), [`duplicate-id-aria`](https://dequeuniversity.com/rules/axe/4.13/duplicate-id-aria), [`frame-title`](https://dequeuniversity.com/rules/axe/4.13/frame-title), [`frame-title-unique`](https://dequeuniversity.com/rules/axe/4.13/frame-title-unique), [`input-button-name`](https://dequeuniversity.com/rules/axe/4.13/input-button-name), [`input-image-alt`](https://dequeuniversity.com/rules/axe/4.13/input-image-alt), [`label`](https://dequeuniversity.com/rules/axe/4.13/label), [`link-name`](https://dequeuniversity.com/rules/axe/4.13/link-name), [`nested-interactive`](https://dequeuniversity.com/rules/axe/4.13/nested-interactive), [`select-name`](https://dequeuniversity.com/rules/axe/4.13/select-name), [`summary-name`](https://dequeuniversity.com/rules/axe/4.13/summary-name). Views: every page and frame the axe suites scan (156 scans). Last run: serious or critical: `nested-interactive` (serious): 24 elements in 2 scans; lower impact: none; left to review by hand: `aria-allowed-attr` (critical): 36 elements in 4 scans; `aria-prohibited-attr` (serious): 12 elements in 4 scans; `aria-valid-attr-value` (critical): 2 elements in 2 scans.
- axe also has `aria-roledescription` (deprecated) for this criterion; axe leaves such rules out by default, so the suite does not run them.
- `UD-006`: Tabs follow the WAI-ARIA tabs pattern; dialogs are labelled modals. Runs in `npm test`: [`apps/web/test/components/Dialog.test.tsx`](../../apps/web/test/components/Dialog.test.tsx) (1 test title), [`apps/web/test/components/Tabs.test.tsx`](../../apps/web/test/components/Tabs.test.tsx) (1 test title).
- `UD-003`: Right and wrong answers carry their state in the accessibility tree. Runs in `npm test`: [`apps/server/test/h5p/hvlFeedback.browser.int.test.ts`](../../apps/server/test/h5p/hvlFeedback.browser.int.test.ts) (2 test titles).

**Manual protocol:** J1.2 «Move through the list of activities.»; J1.5 «Use the tabs «Spel», «Rediger», «Sjekk og publiser».»; J1.6 «In «Rediger», change the question text and save («Lagre»).»; J2.2 «Find the activity's first task with headings or the rotor, and answer one item wrongly.»

**Known H5P upstream barriers (register):**

- `nested-interactive` in the hub of every content type: the hub tabs (role="tab") and the content types (role="button") each contain a focusable link or button. Not repairable by attributes (D-080): the tabs' focus, arrow keys and Enter belong to the inner &lt;a href>, and h5p-hub-client.css lays the tabs out by [role=tab] on the &lt;li> and [role=tab] > a, so moving the role unstyles them and dropping the link drops Enter; a content type is a role="button" &lt;li> (Space uses it) holding its own "Details" button, and no attribute separates the two without removing one control. Source: <https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5p-hub-client.js>. Issue: not filed yet (D-112).

### 4.1.3 Status Messages

Level AA · since WCAG 2.1 · [Understanding 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

<!-- manual:start sc-4.1.3 -->
**Verdict:** Not yet determined

**Evaluated by HVL:** Not yet tested by HVL.

**Manual evidence and remarks:** None yet.
<!-- manual:end sc-4.1.3 -->

**Automated evidence (generated):**

- `UD-006`, accessibility suite: A student answers a MultiChoice question in Canvas and hears the verdict. Views: H5P.MultiChoice in Canvas. Last run: 1 passed. Tests: [`apps/server/a11y/keyboardJourneys.a11y.test.ts`](../../apps/server/a11y/keyboardJourneys.a11y.test.ts) (1 test title).
- `UD-006`, accessibility suite: The outcome of a retry on «Poeng til Canvas» is announced. Views: an activity page in the portal. Last run: 1 passed. Tests: [`apps/server/a11y/axeGradeSync.a11y.test.ts`](../../apps/server/a11y/axeGradeSync.a11y.test.ts) (1 test title).
- `UD-006`, accessibility suite: Adding a question to «Ta opp i samlinga» is said. Views: an activity page in the portal. Last run: 1 passed. Tests: [`apps/server/a11y/axeInsight.a11y.test.ts`](../../apps/server/a11y/axeInsight.a11y.test.ts) (1 test title).
- `UD-006`: Status messages are heard every time. Runs in `npm test`: [`apps/server/test/h5p/editorGoToField.browser.int.test.ts`](../../apps/server/test/h5p/editorGoToField.browser.int.test.ts) (1 test title), [`apps/server/test/h5p/editorGoToTitle.browser.int.test.ts`](../../apps/server/test/h5p/editorGoToTitle.browser.int.test.ts) (2 test titles), [`apps/web/test/features/BankView.test.tsx`](../../apps/web/test/features/BankView.test.tsx) (1 test title), [`apps/web/test/features/OutcomeFields.test.tsx`](../../apps/web/test/features/OutcomeFields.test.tsx) (1 test title), [`apps/web/test/features/insight/InsightShortlist.test.tsx`](../../apps/web/test/features/insight/InsightShortlist.test.tsx) (1 test title).

**Manual protocol:** J1.9 «Open it again; give a reason for each error if asked; activate «Publiser no».»; J1.10 «Open «Læringsdesign» in the main menu (`/laeringsdesign`). Move by headings to «Mønsterkatalogen» and set «Fase» to Forarbeid.»; J2.3 «Check the answer («Sjekk»).»; J3.3 «Add a question to the *Bring to seminar* shortlist.»; J4.3 «Open «Mappe» (`/mappe`), filter by the course, choose the activities with «Vel alle som passar», and pick the criteria set and the language Nynorsk.»; J4.4 «Download «Last ned Markdown (til å redigere)» and «Last ned PDF».»

## 10. Known H5P upstream barriers

Serious and critical axe findings in H5P’s own markup that the theme and the run-time repairs (D-080) cannot remove ([`apps/server/a11y/support/upstreamRegister.ts`](../../apps/server/a11y/support/upstreamRegister.ts)). Each is reported in every run; an entry that stops occurring fails the suite, so this list is current at the run below.

| axe rule | Criteria | Where | Content types | Why it fails and why we cannot repair it | Source at the pinned commit | Issue |
|---|---|---|---|---|---|---|
| `color-contrast` | 1.4.3 | editor | H5P.BranchingScenario | the "Paste" item is disabled by a class only (no aria-disabled), so its text, faded by `opacity: .5` (3.99:1; 3.94:1 under forced colours, which keep the opacity), counts as the text of an active control and assistive technology does not hear that it is unavailable (while the guided tour is open the reuse panel is faded and inert, so it is reported after the tour only) | <https://github.com/h5p/h5p-editor-branching-scenario/tree/8fcd92d0a5a5f6b855d9d03ce4d19ab31baa4b99> | not filed yet (D-112) |
| `nested-interactive` | 4.1.2 | hub | every content type | the hub tabs (role="tab") and the content types (role="button") each contain a focusable link or button. Not repairable by attributes (D-080): the tabs' focus, arrow keys and Enter belong to the inner &lt;a href>, and h5p-hub-client.css lays the tabs out by [role=tab] on the &lt;li> and [role=tab] > a, so moving the role unstyles them and dropping the link drops Enter; a content type is a role="button" &lt;li> (Space uses it) holding its own "Details" button, and no attribute separates the two without removing one control | <https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5p-hub-client.js> | not filed yet (D-112) |

Texts a pinned library writes in English whatever the activity’s language, which axe cannot see (3.1.2):

| Library | Text | Shown when | Why | Source | Issue |
|---|---|---|---|---|---|
| H5P.Video 1.6 | «Video source is missing.» | an InteractiveVideo (or another type holding an H5P.Video) has no video source | H5P.Video merges its English defaults over the l10n it is given ($.extend), so no translation reaches it; V-PLACEHOLDER reports the missing video as an error, so such an activity is not published by mistake | <https://github.com/h5p/h5p-video/blob/af25aef6e9eb8f84db037d564d82494c7d44e267/scripts/video.js> | not filed yet (D-112) |
| H5P.ImageHotspots 1.11 | «Missing required background image» | an ImageHotspots has no background image | the text is written into the markup in English and has no field in the semantics or language files; V-PLACEHOLDER reports the missing image as an error, so such an activity is not published by mistake | <https://github.com/h5p/h5p-image-hotspots/blob/adc855f17f2c86e8741c9299f6d834f8fabc7417/scripts/image-hotspots.js> | not filed yet (D-112) |

## 11. Notes for the uustatus.no statement (manual)

<!-- manual:start uustatus-notes -->
**Status:** 2026-11-05: *not yet written.* Once HVL has set the verdicts, it writes here what the statement on
uustatus.no says: the criteria not met and why, what is planned and when, and the upstream limitations of §10 with
their issue links once they are filed (D-112).
<!-- manual:end uustatus-notes -->

## Appendix A. The last automated run

`npm run test:a11y` on 2026-11-05, commit `5064a494937f` (with uncommitted changes), axe-core 4.13.0: 18 files, 0 of them failed; 508 tests passed, 0 failed, 0 skipped.

| Suite file | File | Passed | Failed | Skipped |
|---|---|---|---|---|
| [`apps/server/a11y/accessibilityDocs.a11y.test.ts`](../../apps/server/a11y/accessibilityDocs.a11y.test.ts) | passed | 3 | 0 | 0 |
| [`apps/server/a11y/axeContentTypes.a11y.test.ts`](../../apps/server/a11y/axeContentTypes.a11y.test.ts) | passed | 21 | 0 | 0 |
| [`apps/server/a11y/axeEditor.a11y.test.ts`](../../apps/server/a11y/axeEditor.a11y.test.ts) | passed | 22 | 0 | 0 |
| [`apps/server/a11y/axeGradeSync.a11y.test.ts`](../../apps/server/a11y/axeGradeSync.a11y.test.ts) | passed | 5 | 0 | 0 |
| [`apps/server/a11y/axeInsight.a11y.test.ts`](../../apps/server/a11y/axeInsight.a11y.test.ts) | passed | 6 | 0 | 0 |
| [`apps/server/a11y/axeSaveChoice.a11y.test.ts`](../../apps/server/a11y/axeSaveChoice.a11y.test.ts) | passed | 2 | 0 | 0 |
| [`apps/server/a11y/axeServerPages.a11y.test.ts`](../../apps/server/a11y/axeServerPages.a11y.test.ts) | passed | 16 | 0 | 0 |
| [`apps/server/a11y/axeStudioViews.a11y.test.ts`](../../apps/server/a11y/axeStudioViews.a11y.test.ts) | passed | 17 | 0 | 0 |
| [`apps/server/a11y/axeWebRoutes.a11y.test.ts`](../../apps/server/a11y/axeWebRoutes.a11y.test.ts) | passed | 50 | 0 | 0 |
| [`apps/server/a11y/firstParty.a11y.test.ts`](../../apps/server/a11y/firstParty.a11y.test.ts) | passed | 48 | 0 | 0 |
| [`apps/server/a11y/keyboardFocus.a11y.test.ts`](../../apps/server/a11y/keyboardFocus.a11y.test.ts) | passed | 47 | 0 | 0 |
| [`apps/server/a11y/keyboardJourneys.a11y.test.ts`](../../apps/server/a11y/keyboardJourneys.a11y.test.ts) | passed | 5 | 0 | 0 |
| [`apps/server/a11y/keyboardStudioJourneys.a11y.test.ts`](../../apps/server/a11y/keyboardStudioJourneys.a11y.test.ts) | passed | 6 | 0 | 0 |
| [`apps/server/a11y/language.a11y.test.ts`](../../apps/server/a11y/language.a11y.test.ts) | passed | 35 | 0 | 0 |
| [`apps/server/a11y/reflowAndMotion.a11y.test.ts`](../../apps/server/a11y/reflowAndMotion.a11y.test.ts) | passed | 112 | 0 | 0 |
| [`apps/server/a11y/targetSize.a11y.test.ts`](../../apps/server/a11y/targetSize.a11y.test.ts) | passed | 31 | 0 | 0 |
| [`apps/server/a11y/textSpacingZoom.a11y.test.ts`](../../apps/server/a11y/textSpacingZoom.a11y.test.ts) | passed | 78 | 0 | 0 |
| [`apps/server/a11y/upstreamRegister.a11y.test.ts`](../../apps/server/a11y/upstreamRegister.a11y.test.ts) | passed | 4 | 0 | 0 |

Files Vitest marked failed (a failed test, or a hook or an import that failed, which leaves the file’s tests skipped or unlisted): none.

Failed tests: none.

axe scanned 156 times (appendix B). Serious and critical findings (the suite fails on any that the register does not list):

| Rule | Impact | Elements | Scans |
|---|---|---|---|
| `color-contrast` | serious | 2 | 2 |
| `nested-interactive` | serious | 24 | 2 |

Lower-impact findings (`minor`, `moderate`; listed, not failing, as UD-030 says):

None.

Left to review by hand (axe’s *incomplete* results, e.g. contrast over a gradient):

| Rule | Impact | Elements | Scans |
|---|---|---|---|
| `aria-allowed-attr` | critical | 36 | 4 |
| `aria-prohibited-attr` | serious | 12 | 4 |
| `aria-valid-attr-value` | critical | 2 | 2 |
| `color-contrast` | serious | 709 | 109 |
| `form-field-multiple-labels` | moderate | 2 | 2 |
| `video-caption` | critical | 4 | 4 |

## Appendix B. Views axe scanned

- forced colours, /h5p/edit/&lt;id> in a frame
- forced colours, /h5p/play/&lt;id> in a frame
- forced colours, Canvas page launched by a student
- forced colours, Canvas page launched by the teacher
- forced colours, Canvas page launched by the teacher, on Rediger
- forced colours, H5P.Blanks fresh
- forced colours, H5P.Blanks started or answered
- forced colours, H5P.BranchingScenario fresh
- forced colours, H5P.BranchingScenario started or answered
- forced colours, H5P.Column fresh
- forced colours, H5P.Column started or answered
- forced colours, H5P.CoursePresentation fresh
- forced colours, H5P.CoursePresentation started or answered
- forced colours, H5P.DragText fresh
- forced colours, H5P.DragText started or answered
- forced colours, H5P.ImageHotspots fresh
- forced colours, H5P.ImageHotspots started or answered
- forced colours, H5P.InteractiveBook fresh
- forced colours, H5P.InteractiveBook started or answered
- forced colours, H5P.InteractiveVideo fresh
- forced colours, H5P.InteractiveVideo started or answered
- forced colours, H5P.MultiChoice fresh
- forced colours, H5P.MultiChoice started or answered
- forced colours, H5P.QuestionSet fresh
- forced colours, H5P.QuestionSet started or answered
- forced colours, signed in: /
- forced colours, signed in: /aktivitet/&lt;MultiChoice draft> (check)
- forced colours, signed in: /aktivitet/&lt;MultiChoice draft> (edit)
- forced colours, signed in: /aktivitet/&lt;MultiChoice draft> (play)
- forced colours, signed in: /aktivitet/&lt;copy> (attribution)
- forced colours, signed in: /aktivitet/&lt;id> (Deling)
- forced colours, signed in: /aktivitet/&lt;id> (Læringsdesign)
- forced colours, signed in: /aktivitet/ny
- forced colours, signed in: /finst-ikkje
- forced colours, signed in: /hjelp
- forced colours, signed in: /laeringsdesign
- forced colours, signed in: /laeringsdesign/innhaldsbank
- forced colours, signed in: /laeringsdesign/innhaldsbank (with entries)
- forced colours, signed in: /laeringsdesign/monster/&lt;id>
- forced colours, signed in: /laeringsdesign/planlegg
- forced colours, signed in: /laeringsdesign/planlegg?emne=&lt;course>
- forced colours, signed in: /mappe
- forced colours, signed in: /mappe (with a word count)
- forced colours, signed in: /personvern
- forced colours, signed in: the publish dialog
- forced colours, signed out: /
- forced colours, signed out: /aktivitet/&lt;id>
- forced colours, signed out: /aktivitet/ny
- forced colours, signed out: /finst-ikkje
- forced colours, signed out: /hjelp
- forced colours, signed out: /laeringsdesign
- forced colours, signed out: /laeringsdesign/innhaldsbank
- forced colours, signed out: /laeringsdesign/monster/&lt;id>
- forced colours, signed out: /laeringsdesign/planlegg
- forced colours, signed out: /mappe
- forced colours, signed out: /personvern
- forced colours, the BranchingScenario editor after its tour
- forced colours, the Canvas page with an invalid ltik
- forced colours, the Canvas page without an ltik
- forced colours, the Deep Linking picker
- forced colours, the answer to a launch of a draft
- forced colours, the editor of H5P.Blanks
- forced colours, the editor of H5P.BranchingScenario
- forced colours, the editor of H5P.Column
- forced colours, the editor of H5P.CoursePresentation
- forced colours, the editor of H5P.DragText
- forced colours, the editor of H5P.ImageHotspots
- forced colours, the editor of H5P.InteractiveBook
- forced colours, the editor of H5P.InteractiveVideo
- forced colours, the editor of H5P.MultiChoice
- forced colours, the editor of H5P.QuestionSet
- forced colours, the picker without an ltik
- forced colours, the save choice dialog
- forced colours, the signed-out page
- forced colours: /aktivitet/[id] Innsikt
- forced colours: /aktivitet/[id] Poeng til Canvas
- forced colours: /app/play Innsikt
- forced colours: /app/play Poeng til Canvas
- light, /h5p/edit/&lt;id> in a frame
- light, /h5p/play/&lt;id> in a frame
- light, Canvas page launched by a student
- light, Canvas page launched by the teacher
- light, Canvas page launched by the teacher, on Rediger
- light, H5P.Blanks fresh
- light, H5P.Blanks started or answered
- light, H5P.BranchingScenario fresh
- light, H5P.BranchingScenario started or answered
- light, H5P.Column fresh
- light, H5P.Column started or answered
- light, H5P.CoursePresentation fresh
- light, H5P.CoursePresentation started or answered
- light, H5P.DragText fresh
- light, H5P.DragText started or answered
- light, H5P.ImageHotspots fresh
- light, H5P.ImageHotspots started or answered
- light, H5P.InteractiveBook fresh
- light, H5P.InteractiveBook started or answered
- light, H5P.InteractiveVideo fresh
- light, H5P.InteractiveVideo started or answered
- light, H5P.MultiChoice fresh
- light, H5P.MultiChoice started or answered
- light, H5P.QuestionSet fresh
- light, H5P.QuestionSet started or answered
- light, signed in: /
- light, signed in: /aktivitet/&lt;MultiChoice draft> (check)
- light, signed in: /aktivitet/&lt;MultiChoice draft> (edit)
- light, signed in: /aktivitet/&lt;MultiChoice draft> (play)
- light, signed in: /aktivitet/&lt;copy> (attribution)
- light, signed in: /aktivitet/&lt;id> (Deling)
- light, signed in: /aktivitet/&lt;id> (Læringsdesign)
- light, signed in: /aktivitet/ny
- light, signed in: /finst-ikkje
- light, signed in: /hjelp
- light, signed in: /laeringsdesign
- light, signed in: /laeringsdesign/innhaldsbank
- light, signed in: /laeringsdesign/innhaldsbank (with entries)
- light, signed in: /laeringsdesign/monster/&lt;id>
- light, signed in: /laeringsdesign/planlegg
- light, signed in: /laeringsdesign/planlegg?emne=&lt;course>
- light, signed in: /mappe
- light, signed in: /mappe (with a word count)
- light, signed in: /personvern
- light, signed in: the publish dialog
- light, signed out: /
- light, signed out: /aktivitet/&lt;id>
- light, signed out: /aktivitet/ny
- light, signed out: /finst-ikkje
- light, signed out: /hjelp
- light, signed out: /laeringsdesign
- light, signed out: /laeringsdesign/innhaldsbank
- light, signed out: /laeringsdesign/monster/&lt;id>
- light, signed out: /laeringsdesign/planlegg
- light, signed out: /mappe
- light, signed out: /personvern
- light, the BranchingScenario editor after its tour
- light, the Canvas page with an invalid ltik
- light, the Canvas page without an ltik
- light, the Deep Linking picker
- light, the answer to a launch of a draft
- light, the editor of H5P.Blanks
- light, the editor of H5P.BranchingScenario
- light, the editor of H5P.Column
- light, the editor of H5P.CoursePresentation
- light, the editor of H5P.DragText
- light, the editor of H5P.ImageHotspots
- light, the editor of H5P.InteractiveBook
- light, the editor of H5P.InteractiveVideo
- light, the editor of H5P.MultiChoice
- light, the editor of H5P.QuestionSet
- light, the picker without an ltik
- light, the save choice dialog
- light, the signed-out page
- light: /aktivitet/[id] Innsikt
- light: /aktivitet/[id] Poeng til Canvas
- light: /app/play Innsikt
- light: /app/play Poeng til Canvas
