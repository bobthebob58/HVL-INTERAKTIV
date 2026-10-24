# packages/hvl-h5p-theme

## Purpose

HVL's theme inside every document H5P renders in (`UD-011`): the player page, the iframes H5P Core writes for
iframe content and the editor's iframe, which the web app's CSS never reaches. It is layered on H5P Core 1.28's
Daylight theme: the design tokens point Daylight's custom properties at HVL's colours, and this package adds HVL's
typography (`UD-002`), the two-tone focus ring (`UD-004`), 24 px targets (`UD-005`), reduced motion for CSS and for
H5P's jQuery animations (`UD-009`) and forced colours (`UD-012`), and shows every correct or incorrect answer with an
icon and a text prefix, not by colour alone (`UD-003`), also in the question types the containers offer. It also
repairs, at run time, H5P markup barriers that an attribute-only change can remove (`UD-030`, D-080).

## How to run

```bash
npm run build --workspace packages/hvl-h5p-theme       # regenerate dist/hvl-feedback-prefixes.css
npm run check --workspace packages/hvl-h5p-theme       # fail when it is out of date
npx vitest run --root packages/hvl-h5p-theme           # generator, structure and script tests
cd apps/server && npx vitest run test/h5p/hvlTheme test/h5p/hvlFeedback   # real types in Chromium
cd apps/server && npx vitest run test/h5p/a11yRepairs.browser.int.test.ts   # the repaired controls by keyboard
```

The server serves the files under `/h5p/theme/<name>?version=<content hash>` and lists them in Lumi's
`customization.global` (`apps/server/src/h5p/h5pAssets.ts`), in this order, after Core's own styles:
`tokens.css`, `h5p-daylight.css` (both from `@hvl-interaktiv/design-tokens`), `hvl-h5p-theme.css`,
`hvl-h5p-targets.css`, `hvl-h5p-feedback.css`, `hvl-h5p-indicators.css`, `hvl-feedback-prefixes.css`, and the scripts
`feedbackPrefixes.js`, `a11yRepairs.js`, `a11yEditorRepairs.js` and `reducedMotion.js`.

## Folder structure

| Path | What it holds |
|---|---|
| `src/hvl-h5p-theme.css` | Typography, colours of pre-Daylight libraries, focus ring, target sizes, reduced motion, forced colours |
| `src/hvl-h5p-targets.css` | Room for 24 px targets where a library's layout leaves none: CoursePresentation's progress bar and footer (outside full screen; the footer above the bar in full screen), QuestionSet's progress-dot spacing |
| `src/hvl-h5p-feedback.css` | Correct/incorrect colours for MultiChoice, Blanks and ImageHotspotQuestion, the hidden and the shown label, and where labels outside the text flow sit |
| `src/hvl-h5p-indicators.css` | DragText's empty drop-zone border and CoursePresentation's answered-task dots at 3 : 1, the dots also in forced colours |
| `src/feedbackPrefixes.js` | Browser script: adds the prefix label to each answer state (hidden, or shown where the library uses the pseudo-elements) and puts it in front of an `aria-label` name |
| `src/feedbackTargets.json` | Per library: which element shows a state, where the visible prefix goes (`::before`, `::after` or `"label"`), whether it has its own icon |
| `src/reducedMotion.js` | Browser script: turns H5P's jQuery animations off (`H5P.jQuery.fx.off`) while the reader asks for reduced motion |
| `src/a11yRepairs.js` | Browser script: names, roles and levels the content types' own markup (what a learner sees) lacks (D-080; documented in its header) |
| `src/a11yEditorRepairs.js` | Browser script: names, roles and labels H5P's editor, its widgets and the hub's list lack, and `inert` on the parts BranchingScenario's tour fades (D-080; documented in its header) |
| `src/locales/{nn,nb,en}.json` | `feedback.correctPrefix` and `feedback.incorrectPrefix` (`✓ Riktig:` / `✗ Feil:`, `✓ Correct:` / `✗ Incorrect:`) |
| `scripts/buildFeedbackPrefixes.mjs` | Generates `dist/hvl-feedback-prefixes.css` from the locales and targets; `--check` for drift |
| `scripts/feedbackTargetList.mjs` | Reads and checks `src/feedbackTargets.json` for the generator |
| `dist/hvl-feedback-prefixes.css` | Generated: `:lang()` prefix texts, the target lists for the script, the `::before` and `::after` prefixes |
| `test/` | Generator, theme structure and script (jsdom) tests; `test/support/` opens the jsdom documents (`prefixDocument.ts` for the prefixes, `repairDocument.ts` for both repair scripts) |
| `.gitignore` | Re-includes `dist/` (the root ignores every `dist/`) |

## Key flows

```mermaid
sequenceDiagram
  participant L as Learner
  participant P as Player page /h5p/play/:id (html lang = UI locale)
  participant C as H5P Core and the library (e.g. MultiChoice)
  participant T as Theme CSS (tokens, Daylight mapping, theme, prefixes)
  participant S as feedbackPrefixes.js
  participant AT as Screen reader
  P->>T: load after Core's styles, before the libraries' styles
  P->>S: load after Core's scripts (same origin, no inline code)
  C->>P: render the activity (or write an iframe with H5PIntegration.core styles and scripts)
  L->>C: answer and press Check
  C->>P: add .h5p-wrong to the answer
  T->>P: ::before shows "✗ Feil:" (or "Feil:" beside the library's own ✗), alt text ""
  S->>P: MutationObserver sees the class; adds <span class="hvl-feedback-sr">Feil: </span>
  AT->>P: reads "Feil: <answer>" once; the icon is not announced
  L->>C: Retry
  C->>P: remove .h5p-wrong
  S->>P: remove the hidden label
```

**Language.** The prefix follows the language of the element, through `:lang()` rules generated from the locale
files; the script reads its label from the same custom properties, so the visible and the announced text agree. On
our player page `<html lang>` is the UI locale (`nn` when unknown). In an iframe H5P Core writes itself, Core sets
`<html lang>` to the activity's `metadata.defaultLanguage` (or `en`). A `lang` attribute on the content container
(`UD-010`) takes precedence for everything inside it. `nb` also answers to `no`; any other language gets the
document's prefix, and `nn` when the document has none.

**Icons.** MultiChoice 1.16, Blanks 1.14, DragText 1.10, TrueFalse 1.8, MarkTheWords 1.11, SingleChoiceSet 1.11 (the
chosen alternative), Summary 1.10, MultiMediaChoice 0.3 and ImageHotspotQuestion 1.8 draw their own ✓/✗ icon for a
state, so their visible prefix is the label alone ("Feil:") and the icon is not doubled. States without a ✓/✗ get the
full prefix ("✗ Feil:"): Question 1.5's explanation list, MultiChoice's solution (a filled or empty radio), a word
MarkTheWords shows as missed and the alternatives SingleChoiceSet reveals. DragText's dropzones have a fixed width, so
its visible prefix stands before the dropzone, and the hidden label is inside the word. SingleChoiceSet styles the
answer's first paragraph as `:first-child`, so the label goes into that paragraph, not before it.
ImageHotspotQuestion marks the learner's click with a fixed 32 px circle inside an image that clips it: the hidden
label is in the circle, and the visible one is the image's `::after` (`prefixPseudo: "after"`), anchored beside the
circle on the side where the image has room (CSS anchor positioning; without it, in the image's top corner).

**Shown labels and names.** TrueFalse, Summary and MultiMediaChoice use the pseudo-elements of the answer themselves,
so `prefixOn: "label"` lets the script show its label as text (`.hvl-feedback-text`), which is then both the visible
and the announced prefix. A radio, checkbox, option or button named by `aria-label` does not read its content
(Summary's wrong claim, MultiMediaChoice's option), so the script also puts the label in front of that name, unless
the name already states it as H5P writes it (the word and a full stop: Summary's "Feil. …"; an alt text that merely
begins with the word, such as "Riktig handplassering", still gets the label), and gives the name back when the state
ends.

## Configuration

None at run time; see the [server's .env.example](../../apps/server/.env.example) for the server. Texts are i18n keys
in `src/locales` (key parity checked by `npm run doc:lint`); after changing them run the build. To cover a new
library, add an entry to `src/feedbackTargets.json` (choose an element whose `::before` (or `::after`, with
`prefixPseudo`) the library does not use and whose children it neither counts nor selects by position, or
`prefixOn: "label"` when there is none; an entry may name one state only) and extend
`apps/server/test/h5p/hvlFeedbackContainers.browser.int.test.ts`.

## Implements

- `UD-011` — the theme on top of Daylight in every H5P document; every `!important` names the H5P selector it beats.
- `UD-003` — icon and text prefix for answer states in MultiChoice, Blanks, DragText, QuestionSet (its questions and
  explanations) and the question types the containers offer (TrueFalse, MarkTheWords, SingleChoiceSet, Summary,
  MultiMediaChoice, ImageHotspotQuestion); the prefix is in the accessibility tree. The spec names the xAPI bridge for the hidden text node;
  that bridge arrives in S6, so `src/feedbackPrefixes.js` does it now.
- `UD-002`, `UD-004`, `UD-005`, `UD-009`, `UD-012` — inside H5P, with the values of `@hvl-interaktiv/design-tokens`;
  `UD-009` also for jQuery's animations (`src/reducedMotion.js`).
- `UD-001` — non-text contrast of what Daylight draws below 3 : 1 (DragText's empty drop zones, CoursePresentation's
  answered-task dots, `src/hvl-h5p-indicators.css`); the pairs are declared in `@hvl-interaktiv/design-tokens`'
  `tokens.json`. Under forced colours an answered dot stays filled (`UD-012`).
- `UD-010` — the prefix language follows `lang`.
