# Draft: H5P issue, QuestionSet's reset breaks when a page holds more than one set

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-question-set` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **Our records** | D-115 (its amendments of 2026-11-04, Q20), D-112's amendment of 2026-10-30, PROGRESS S6 step 3 |
| **Checked** | 2026-11-05: QuestionSet 1.21.13 (pinned) observed; the default branch (a961bac, 1.21.14) read, same line |

---

## Title

[Bug]: Question Set: "Retry" throws when another Question Set is on the same page (`resetTask` walks every `.h5p-progress-dot` in the document)

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- H5P.QuestionSet 1.21.13 (tag 1.21.13, commit 4598d1d6); the same code is on the default branch at a961bac
  (1.21.14), `js/questionset.js` line 521.
- H5P.Components 1.0.99 (commit 223a9164), H5P.InteractiveBook 1.15.1 (commit 90efced9).
- H5P Core 1.28.0; Chromium 141 (Playwright 1.56.1); Nynorsk, though the language does not matter.

### Steps to reproduce

1. Create an Interactive Book with three chapters, each holding one Question Set of three single-answer questions.
   (Our case also turns off the sets' own results-page "Retry" and turns on each question's own "Retry"; the fault
   does not depend on it.)
2. View the book. While it loads, the document holds the progress dots of two sets (six dots).
3. In chapter 1, answer the three questions and press "Finish".
4. Go to the book's summary page (nine dots in the document now) and press the book's "Retry".

### Expected

Every chapter is reset, chapter 1's Question Set shows its first question again, and the book returns to its start.

### Actual

- The console shows one `TypeError: Cannot read properties of undefined (reading 'classList')`, from
  `toggleFilledDot` in H5P.Components' `h5p-progress-dots.js`.
- The book stays on its summary page, and chapter 1's set keeps its results page: a finished check cannot be
  retried at all.

### Cause

`resetTask` marks every task unanswered with

```js
$('.h5p-progress-dot').each(function (idx) {
  toggleAnsweredDot(idx, false);
});
```

The selector has no context, so it matches the dots of every Question Set in the document. `toggleAnsweredDot`
passes each index to this set's own `progressDots.toggleFilledDot`, which reads `progressDotElements[idx]`; for an
index past this set's own dots that element is `undefined`, and the reset stops there. Other lines in the same file
already scope their selector to the set (for example `$('.h5p-progress-dot.current', $myDom)`).

Reading the code, the same should happen with the set's own results-page "Retry" when two Question Sets share a
page (in a Column, for example); we have not observed that case.

### Suggested fix

Scope the selector to the set, `$('.h5p-progress-dot', $myDom)`, or loop over this set's own questions:
`questionInstances.forEach((_, idx) => toggleAnsweredDot(idx, false))`.

### Our workaround

Our "module" pattern (`content/laeringsdesign/patterns/uv-module/skeleton.json`) turns off each set's results-page
"Retry" (`endGame.showRetryButton: false`) and keeps each question's own "Retry" on (`override.retryButton: "on"`),
so learners can retry every question until the set is finished. The book's own "Retry" still fails as above; we
have not changed library behaviour at run time. Our test `uvModuleBookRetry.browser.int.test.ts` ("upstream pin:
QuestionSet 1.21 makes uv-module’s book «Prøv igjen» throw, and nothing is reset") plays this case on the real
libraries and fails once a pinned version fixes it.
