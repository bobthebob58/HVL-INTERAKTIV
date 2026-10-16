# Spec 03 — HVL Visual Identity, Universal Design (WCAG 2.2 AA) and the Pre-Publish Validator

| | |
|---|---|
| **Status** | Approved for build (v1.0, 2026-10-16) |
| **Load in sessions** | S4 (all); S6 (§6 conformance report) |
| **Owns requirement IDs** | `UD-*` |
| **Code location** | `packages/design-tokens/`, `packages/hvl-h5p-theme/`, `apps/web/src/components/`, `apps/server/src/validation/` |

---

## 1. Legal and institutional baseline

- **Statutory floor:** the Norwegian *forskrift om universell utforming av IKT-løysingar* requires
  the WCAG 2.1 success criteria it lists (based on EN 301 549). UUtilsynet supervises compliance.
  Public bodies must publish an accessibility statement (*tilgjengelegheitserklæring*) on uustatus.no.
- **Project target:** **WCAG 2.2 Level AA in full.** This adds 2.4.11 *Focus Not Obscured
  (Minimum)*, 2.5.7 *Dragging Movements*, 2.5.8 *Target Size (Minimum)*, 3.2.6 *Consistent Help*,
  3.3.7 *Redundant Entry* and 3.3.8 *Accessible Authentication (Minimum)*.
- **HVL house rules (ALU's universal design guidance):** line height ≥ 1.5; left-aligned, ragged-right
  text; no justified text; underline reserved for links; bold, not italics or capitals, for emphasis;
  no ALL-CAPS styling; links say where they go (external site, file type).

---

## 2. Design tokens (single source of truth)

Tokens live in `packages/design-tokens/tokens.json`. A build step generates CSS custom properties
(used by the web app and by `hvl-h5p-theme.css`) and a Tailwind preset. **No colour value may appear
anywhere else in the codebase.** A lint rule rejects hex literals outside the tokens package.

Contrast ratios below were **computed** with the WCAG 2.x relative-luminance formula on
2026-10-16. A unit test recomputes them on every build (`UD-001`). Brand hex values must still be
checked against the HVL design manual (`docs/reference/hvl-designmanual-og-logo.zip`). If they
change, the test decides whether the new values may be used.

| Token | Value | Used for | Measured contrast | Requirement met |
|---|---|---|---|---|
| `--hvl-primary-dark` | `#003D4C` (deep fjord teal) | Headings, navigation, primary buttons (white text) | 11.85 : 1 on `#FFFFFF`; 10.93 : 1 on `#F4F6F7` | Text AA and AAA |
| `--hvl-primary-accent` | `#005F6B` (coastal teal) | Links, secondary buttons, progress bars | 7.37 : 1 on `#FFFFFF`; 6.80 : 1 on `#F4F6F7` | Text AA (AAA on white) |
| `--hvl-primary-accent-light` | `#007681` | Large text, non-text UI only | 5.37 : 1 on `#FFFFFF`; 4.96 : 1 on `#F4F6F7` | Text AA; non-text 3 : 1 |
| `--hvl-ink` | `#111111` | Body text | 18.88 : 1 on `#FFFFFF`; 17.42 : 1 on `#F4F6F7` | AAA |
| `--hvl-ink-muted` | `#4A5560` | Secondary text | 7.61 : 1 on `#FFFFFF` | AAA |
| `--hvl-surface` / `--hvl-surface-warm` | `#FFFFFF` / `#F4F6F7` | Cards / page background | — | — |
| `--hvl-feedback-correct-fg` on `-bg` | `#0F5132` on `#D1E7DD` | Correct-answer text | 7.21 : 1 | AAA |
| `--hvl-feedback-correct-border` | `#198754` | 4 px left border (decorative; the text prefix carries the meaning) | 3.49 : 1 on its background | Non-text 3 : 1 |
| `--hvl-feedback-incorrect-fg` on `-bg` | `#842029` on `#F8D7DA` | Incorrect-answer text | 7.08 : 1 | AAA |
| `--hvl-feedback-incorrect-border` | `#DC3545` | 4 px left border (decorative) | 3.39 : 1 on its background | Non-text 3 : 1 |
| `--hvl-feedback-info-fg` on `-bg` | `#055160` on `#CFF4FC` | Hints, notices | 7.65 : 1 | AAA |
| `--hvl-focus-inner` / `--hvl-focus-outer` | `#FFFFFF` / `#003D4C` | Two-tone focus ring (see `UD-004`) | outer ring 11.85 : 1 on white; inner ring separates it from dark fills | 1.4.11 and 2.4.7 on every surface |

> **Corrections to the development plan.** The plan's figures for the feedback colours were
> overstated (it gave 8.3 : 1 and 7.6 : 1; the measured values are 7.21 : 1 and 7.08 : 1, which
> still pass AAA). More importantly, it proposed a **single orange focus outline `#FF9E1B`**. That
> measures **2.07 : 1 on white** and fails WCAG 1.4.11 (non-text contrast ≥ 3 : 1). It is replaced by
> the two-tone ring. Orange may still be used *inside* the ring as a brand accent, but never as the
> only indicator. (D-007)

---

## 3. Requirements — design system and theme

#### UD-001 · MUST · S4 · Tokens are the only source of colour, and contrast is tested
- **Acceptance:** `packages/design-tokens/test/contrast.test.ts` declares every foreground and background
  pairing actually used and asserts ≥ 4.5 : 1 for text, ≥ 3 : 1 for large text and non-text UI. A
  Stylelint rule fails on hex, `rgb()` or `hsl()` literals outside `packages/design-tokens/`.
- **Verify:** Unit test; lint in CI.

#### UD-002 · MUST · S4 · Typography and reading comfort
Body text uses `font-family: Inter, Arial, Calibri, sans-serif` (Inter self-hosted, `DATA-011`),
`font-size` ≥ 1rem, `line-height: 1.5` (1.55 inside H5P), `text-align: left`, and `max-width: 70ch`
for paragraphs. `text-transform: uppercase` and `text-align: justify` are forbidden by a Stylelint
rule. Underline is used only for links. All sizes are in `rem` or `em`. Layout survives 200 % text
resize (1.4.4) and the text-spacing overrides of 1.4.12.
- **Verify:** Stylelint rules; a Playwright test applies the 1.4.12 bookmarklet styles and checks for clipped text.

#### UD-003 · MUST · S4 · Feedback never relies on colour alone (WCAG 1.4.1)
Every correct or incorrect state shows an icon **and** a text prefix as well as colour:
**✓ Riktig:** / **✗ Feil:** (`nn`, `nb`), **✓ Correct:** / **✗ Incorrect:** (`en`). Prefixes are i18n
keys (`feedback.correctPrefix`, `feedback.incorrectPrefix`). In H5P iframes, the theme adds them with
CSS `::before` content **and** the xAPI bridge script adds a visually hidden text node, so screen
readers announce them consistently. Icons are `aria-hidden="true"`.
- **Acceptance:** Shown for MultiChoice, QuestionSet, Blanks, DragText and the answer states inside
  containers. Checked in greyscale screenshots.
- **Verify:** Playwright tests per content type, asserting the text prefix in the accessibility tree.

#### UD-004 · MUST · S4 · Visible, unobscured focus (2.4.7, 2.4.11, 1.4.11)
`:focus-visible { outline: 3px solid var(--hvl-focus-outer); outline-offset: 2px; box-shadow: 0 0 0 2px var(--hvl-focus-inner); }`.
This is applied in the web app and inside H5P iframes. Sticky headers set `scroll-padding-top` so a
focused element is never hidden behind them.
- **Verify:** Playwright test tabs through each route and asserts that the focused element is in
  the viewport and not covered (by `elementFromPoint`).

#### UD-005 · MUST · S4 · Target size ≥ 24 × 24 CSS px (2.5.8) and no drag-only actions (2.5.7)
Every pointer target in the web app meets 2.5.8. Every drag interaction has a single-pointer
alternative. In H5P, DragText's keyboard and click mode counts as that alternative. DragQuestion is
excluded for this reason (`H5P-002`).
- **Verify:** Playwright measurement script over interactive elements.

#### UD-006 · MUST · S4 · Fully keyboard operable
There is a skip link to `<main>`. Focus order is logical. There are no keyboard traps, including
modal dialogs, which return focus on close. All custom widgets follow the WAI-ARIA Authoring
Practices patterns.
- **Verify:** Keyboard-only Playwright scripts for J1–J4; manual check (`UD-031`).

#### UD-007 · MUST · S4 · Honest links
External links get a visible icon plus visually hidden text "(opnar ekstern nettstad)" or the
nb/en equivalent. File links show type and size ("PDF, 1.2 MB"). Link text never reads "klikk her"
or "click here".
- **Verify:** Component tests of `<ExternalLink>` and `<FileLink>`; validator rule `V-LINK-TEXT`.

#### UD-008 · MUST · S4 · Reflow, zoom and orientation
No horizontal scroll at 320 CSS px width (1.4.10), except for content that needs two dimensions,
such as images with hotspots, which may pan. Works in both orientations.
- **Verify:** Playwright at 320 × 640 for every route and content type.

#### UD-009 · MUST · S4 · Motion and media
Respect `prefers-reduced-motion`. No autoplay with sound. Nothing flashes more than 3 times per second.
- **Verify:** CSS review; Playwright with reduced motion emulated.

#### UD-010 · MUST · S4 · Language of page and parts
`<html lang>` follows the UI locale (`nn`, `nb`, `en`). Each H5P content item carries its own
`metadata.defaultLanguage`, and the player sets `lang` on the content container.
- **Verify:** Playwright assertions.

#### UD-011 · MUST · S4 · HVL theme inside H5P iframes
`packages/hvl-h5p-theme/src/hvl-h5p-theme.css` is layered **on top of** H5P Core 1.28's Daylight
theme. It overrides Daylight's custom properties where possible and selectors only where necessary.
Every `!important` has a `/* WHY: … */` comment naming the H5P selector it beats. The theme covers:
tokens, typography (`UD-002`), feedback states (`UD-003`), focus (`UD-004`) and target size (`UD-005`).
- **Verify:** Playwright and axe inside the iframe for one seed activity of each of the ten types (`UD-030`).

#### UD-012 · SHOULD · S4 · Windows high-contrast and forced colours
Under `@media (forced-colors: active)`, focus rings and feedback borders use system colours
(`Highlight`, `CanvasText`), and no information is lost.
- **Verify:** Playwright with forced colours emulated.

#### UD-013 · MUST · S4 · Consistent help and accessible errors (3.2.6, 3.3.1, 3.3.3, 3.3.7)
A **Hjelp** link appears in the same place on every page. Form errors are listed in a summary at
the top and linked to their fields with `aria-describedby`. Data the user has already entered is not
asked for again (3.3.7). Login uses Feide or Canvas only, with no cognitive tests (3.3.8).
- **Verify:** Component tests; axe.

---

## 4. Requirements — pre-publish validator

#### UD-020 · MUST · S4 · Validator engine
`apps/server/src/validation/validateContent.ts` exports a **pure function**:

```ts
/**
 * Inspects authored H5P parameters for universal design and pedagogical problems.
 * Pure and deterministic: no I/O, so it can run on save, on publish, and in tests.
 */
function validateContent(input: {
  mainLibrary: string;            // e.g. "H5P.InteractiveVideo 1.28"
  params: unknown;                // content.json
  metadata: H5PMetadata;          // h5p.json-style metadata
  locale: 'nn' | 'nb' | 'en';
}): Finding[];

interface Finding {
  ruleId: string;                 // e.g. "V-IMG-ALT"
  severity: 'error' | 'warning' | 'hint';
  requirement: string;            // spec ID, e.g. "UD-021"
  path: string;                   // JSON path into params, for "Go to field"
  message: string;                // localised, plain language, says what to do
}
```

The walker visits nested sub-content recursively (any object with `library: "H5P.X a.b"` and
`params`). Each rule is a separate file under `validation/rules/`, ≤ 100 lines, with its own test.
Pedagogical hint rules (`PED-H*`) are specified in [04 §5](04-laeringsdesign-page.md#5-pedagogical-hint-rules)
and plug into the same engine.

#### UD-021 · MUST · S4 · Rule set (universal design)

| Rule ID | Checks | Severity |
|---|---|---|
| `V-IMG-ALT` | `H5P.Image` (and images inside `ImageHotspots`, `CoursePresentation`, `InteractiveBook`) have non-empty `alt`. The alt text must not look like a filename (`/\.(jpe?g\|png\|gif\|webp\|svg)$/i`, `image1`, `bilde`, `IMG_1234`), unless the image is marked decorative. | error |
| `V-IMG-ALT-LENGTH` | Alt text is longer than 250 characters. Suggest a long description in the text instead. | warning |
| `V-VID-CAPTIONS` | `H5P.InteractiveVideo` and `H5P.Video` have at least one text track (`.vtt`), **or** the source is a Panopto URL listed as captioned. | error |
| `V-VID-TRANSCRIPT` | There is no transcript or text alternative linked. | warning |
| `V-HOTSPOT-ORDER` | `ImageHotspots` hotspots are not numbered or ordered, or a hotspot has no header text. | warning |
| `V-TABLE-HEADERS` | Tables in `AdvancedText` or `Table` have no `<th>` row or column. | warning |
| `V-HEADING-ORDER` | Rich text headings skip levels (e.g. h2 → h4). | warning |
| `V-LINK-TEXT` | Link text is "klikk her", "her", "click here", "les meir" or a bare URL. | warning |
| `V-LANG` | `metadata.defaultLanguage` is missing. | warning |
| `V-COLOUR-WORDS` | The text refers to colour alone ("the red option", "det grøne feltet"). | hint |
| `V-BRANCH-COLOUR` | A BranchingScenario choice relies on colour coding without text. | warning |

- **Acceptance:** Each rule has positive and negative fixtures under `apps/server/test/fixtures/content/`.
- **Verify:** Unit tests `[UD-021][V-IMG-ALT] …` etc.

#### UD-022 · MUST · S4 · Acknowledgements are recorded
When an author publishes despite an *error* (`PROD-003`), a `ValidationAcknowledgement`
`(contentId, ruleId, path, reason, userId, at)` is stored. Acknowledgements are listed in insight and
in the portfolio export.
- **Verify:** Integration test.

---

## 5. Requirements — verification

#### UD-030 · MUST · S4 · Automated accessibility tests
`@axe-core/playwright` runs with the tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` on every
web route and inside the iframe of one seed activity per content type, in both light theme and
forced-colours mode. CI fails on any violation with impact `serious` or `critical`. Lower-impact
findings are listed in the report.
- **Verify:** `npm run test:a11y`.

#### UD-031 · MUST · S4 · Manual assistive-technology protocol
Automated tools find only part of the barriers. `docs/accessibility/manual-test-protocol.md` (written
in Session 4) defines scripted tasks for J1–J4. They are run with NVDA + Firefox, JAWS + Chrome,
VoiceOver + Safari on iOS, keyboard only, and 400 % zoom. Results are recorded per release in
`docs/accessibility/results/`.
- **Verify:** Evaluator checks that a dated result file exists for the release.

---

## 6. Conformance documentation (Session 6)

#### UD-040 · MUST · S6 · WCAG conformance report
`docs/accessibility/WCAG-CONFORMANCE-REPORT.md` maps every WCAG 2.2 A/AA criterion to: *Supports /
Partially supports / Does not support / Not applicable*, the evidence (test file, manual protocol
result), and known H5P upstream limitations with links to the issues. It is the input HVL needs for
its uustatus.no statement.
- **Verify:** Evaluator review; the script `npm run a11y:report` regenerates the automated parts.
