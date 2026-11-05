# Draft: H5P accessibility report, H5P.InteractiveVideo 1.28

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-interactive-video` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README), or a pull request with the one-line fix below |
| **Status** | Ready |
| **WCAG 2.2** | 3.1.2 Language of Parts |
| **Our records** | D-080 (`UPSTREAM_ENGLISH_TEXTS`), D-111 (its review amendment of 2026-11-05), D-112 |
| **Checked** | 2026-11-05 against 1.28.37 (tag 1.28.37, commit bcfa06d2) and the default branch (114f513, 2026-10-28) |

---

## Title

[Bug]: End screen: the summary of a scored question is always English, because `endCardTableRowSummary` does not exist

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- H5P.InteractiveVideo 1.28.37 (commit bcfa06d2); the default branch at 114f513 has the same code. H5P Core 1.28.0;
  content language Nynorsk (`nn`), the same with any language other than English.
- Our host runs Lumi's Node.js server; the text comes from the library.

### Steps to reproduce

1. Create an Interactive Video in a language other than English, with at least one scored interaction (for example
   a Single Choice Set).
2. As a learner, answer the interaction and open the end screen (play to the end, or press the star in the bar).
3. With a screen reader, or in the accessibility tree, read the name of the question's row on the end screen.

### Expected

The row's accessible name is in the content's language: the author's or the language file's text of the field
`endCardTableRowSummaryWithScore` ("Summary of a question with score" in the editor).

### Actual

`src/scripts/interactive-video.js` (line 1356) passes `tableRowSummary: this.l10n.endCardTableRowSummary` to the end
screen, but the semantics field is named `endCardTableRowSummaryWithScore` (`semantics.json`, line 1115), so the value
is `undefined`. The end screen reads `this.l10n.tableRowSummaryWithScore` (`src/scripts/endscreen.js`, line 252),
which nothing sets, so its English default (line 45) is used: "You got @score out of @total points for the @question
that appeared after @minutes minutes and @seconds seconds." The row's `aria-label` (`buildQuestionAriaLabel`) is
therefore English for every scored question in every language, and a screen reader reads it with the page language's
pronunciation. The summary of an unscored question (`tableRowSummaryWithoutScore`) is passed under its right name and
is translated. The language files' own translations of the scored summary (for example `language/nn.json`) are never
shown.

### Suggested fix

In `interactive-video.js`, pass the field under the end screen's name:
`tableRowSummaryWithScore: this.l10n.endCardTableRowSummaryWithScore`.

### Our workaround

None: no language file or author text reaches the end screen. HVL's language overlay translates the summary without a
score in Nynorsk and Bokmål (D-111); the scored summary is listed in our register of upstream barriers
(`apps/server/a11y/support/upstreamRegister.ts`, `UPSTREAM_ENGLISH_TEXTS`). Our test `upstreamRegister.a11y.test.ts`
("[UD-010] "You got @score out of @total points for the @question that appeared after @minutes minutes and @seconds
seconds." is still written by the pinned library, so its entry still holds") fails once a pinned version stops writing
it.

A separate, smaller point for a language-file pull request rather than this issue: `language/nn.json` has the English
word "and" in the Nynorsk summaries ("… etter @minutes minutt and @seconds sekund."). HVL's reviewed Nynorsk and Bokmål
texts can go upstream that way (D-112), once HVL's language advisers have reviewed them.
