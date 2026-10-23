# packages/hvl-h5p-theme

## Purpose

HVL's theme inside every document H5P renders in (`UD-011`): the player page, the iframes H5P Core writes for
iframe content and the editor's iframe, which the web app's CSS never reaches. It is layered on H5P Core 1.28's
Daylight theme: the design tokens point Daylight's custom properties at HVL's colours, and this package adds HVL's
typography (`UD-002`), the two-tone focus ring (`UD-004`), 24 px targets (`UD-005`), reduced motion (`UD-009`) and
forced colours (`UD-012`), and shows every correct or incorrect answer with an icon and a text prefix, not by colour
alone (`UD-003`).

## How to run

```bash
npm run build --workspace packages/hvl-h5p-theme       # regenerate dist/hvl-feedback-prefixes.css
npm run check --workspace packages/hvl-h5p-theme       # fail when it is out of date
npx vitest run packages/hvl-h5p-theme                  # generator, structure and script tests
cd apps/server && npx vitest run test/h5p/hvlTheme.browser.int.test.ts   # the real content types in Chromium
```

The server serves the files under `/h5p/theme/<name>?version=<content hash>` and lists them in Lumi's
`customization.global` (`apps/server/src/h5p/h5pAssets.ts`), in this order, after Core's own styles:
`tokens.css`, `h5p-daylight.css` (both from `@hvl-interaktiv/design-tokens`), `hvl-h5p-theme.css`,
`hvl-h5p-feedback.css`, `hvl-feedback-prefixes.css`, and the script `feedbackPrefixes.js`.

## Folder structure

| Path | What it holds |
|---|---|
| `src/hvl-h5p-theme.css` | Typography, colours of pre-Daylight libraries, focus ring, target sizes, reduced motion, forced colours |
| `src/hvl-h5p-feedback.css` | Correct/incorrect colours for MultiChoice and Blanks, the hidden label's style |
| `src/feedbackPrefixes.js` | Browser script: adds the visually hidden prefix label to each answer state |
| `src/feedbackTargets.json` | Per library: which element shows a state, where the visible prefix goes, whether it has its own icon |
| `src/locales/{nn,nb,en}.json` | `feedback.correctPrefix` and `feedback.incorrectPrefix` (`✓ Riktig:` / `✗ Feil:`, `✓ Correct:` / `✗ Incorrect:`) |
| `scripts/buildFeedbackPrefixes.mjs` | Generates `dist/hvl-feedback-prefixes.css` from the locales and targets; `--check` for drift |
| `dist/hvl-feedback-prefixes.css` | Generated: `:lang()` prefix texts, the target lists for the script, the `::before` prefixes |
| `test/` | Generator, theme structure and script (jsdom) tests |
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

**Icons.** MultiChoice 1.16, Blanks 1.14 and DragText 1.10 draw their own ✓/✗ icon for a state, so their visible
prefix is the label alone ("Feil:") and the icon is not doubled; Question 1.5's explanation list has no icon and
gets the full prefix ("✗ Feil:"). DragText's dropzones have a fixed width, so its visible prefix stands before the
dropzone, and the hidden label is inside the word.

## Configuration

None at run time; see the [server's .env.example](../../apps/server/.env.example) for the server. Texts are i18n keys
in `src/locales` (key parity checked by `npm run doc:lint`); after changing them run the build. To cover a new
library, add an entry to `src/feedbackTargets.json` (choose an element whose `::before` the library does not use and
whose children it does not count) and extend `apps/server/test/h5p/hvlTheme.browser.int.test.ts`.

## Implements

- `UD-011` — the theme on top of Daylight in every H5P document; every `!important` names the H5P selector it beats.
- `UD-003` — icon and text prefix for answer states in MultiChoice, Blanks, DragText, QuestionSet (its questions and
  explanations) and the same types inside containers; the prefix is in the accessibility tree. The spec names the
  xAPI bridge for the hidden text node; that bridge arrives in S6, so `src/feedbackPrefixes.js` does it now.
- `UD-002`, `UD-004`, `UD-005`, `UD-009`, `UD-012` — inside H5P, with the values of `@hvl-interaktiv/design-tokens`.
- `UD-010` — the prefix language follows `lang`.
