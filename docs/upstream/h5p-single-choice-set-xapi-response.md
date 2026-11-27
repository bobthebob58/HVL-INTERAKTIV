# Draft: H5P issue, Single Choice Set's `answered` statement reports the place on screen, not the chosen alternative

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-single-choice-set` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **Our records** | D-151, PROGRESS step 35 |
| **Checked** | 2026-11-27: SingleChoiceSet 1.11.89 (pinned, commit d570a968) read and observed; the default branch read the same day: also 1.11.89, with the same lines (`scripts/single-choice-set.js` 202, 203 and 234) |

---

## Title

[Bug]: Single Choice Set: the xAPI `answered` statement of a question gives the alternative's position on screen as the response, and judges `success` and `score` by it

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 159, through Playwright 1.65.1)
- **Operating system:** Linux, Ubuntu 24.04

### Versions

- H5P.SingleChoiceSet 1.11.89 (tag 1.11.89, commit d570a968; the default branch holds the same version and
  lines), inside H5P.Column 1.22.
- H5P Core 1.28.0; Chromium 159 (Playwright 1.65.1); Nynorsk, though the language does not matter.

### Steps to reproduce

1. Create a Single Choice Set with one question and two alternatives. The first alternative in the editor is the
   right one, as the library's rule is.
2. Listen for xAPI statements: `H5P.externalDispatcher.on('xAPI', (event) => console.log(event.data.statement))`.
3. View the set and choose the right alternative. Note whether it was shown first or second.
4. Reload and repeat a few times. The library shuffles the alternatives, so the right one is shown first in about
   half of the views.

### Expected

The question's `answered` statement says the same every time the right alternative is chosen:
`result.success: true`, `result.score.raw: 1`, and a `result.response` that names the chosen alternative in the
order of `object.definition.choices` and `correctResponsesPattern` (`"0"`, the first stored alternative).

### Actual

- When the right alternative happens to be shown second, the statement has `result.response: "1"`,
  `result.success: false` and `result.score.raw: 0`, although the answer was right, the set shows it as right and
  the set's own score counts it as right.
- When a wrong alternative happens to be shown first and is chosen, the statement has `result.response: "0"`,
  `result.success: true` and `result.score.raw: 1`.
- With five learners who all chose the right alternative of one question and all chose a wrong alternative of
  another (two alternatives each), our stored statements gave 3 of 5 "right" for both questions.

### Cause

`scripts/single-choice-set.js` keeps two records when an alternative is chosen (`handleAlternativeSelected`):

```js
self.userResponses[event.data.index] = event.data.currentIndex;   // $element.index(): the place on screen
self.userAnswerIndex[event.data.index] = event.data.answerIndex;  // the index before shuffling; 0 is right
```

`handleQuestionFinished` builds the statement from the first one:

```js
const xapiEvent = self.createXApiAnsweredEvent(self.options.choices[index], self.userResponses[index], duration);
```

and `createXApiAnsweredEvent` uses that value as the response and judges by it:

```js
.response(userAnswer.toString())
.score((userAnswer === 0) ? 1 : 0, 1)
.success(userAnswer === 0)
```

The statement's own `choices` and `correctResponsesPattern` are in stored order, so the response does not match
them. The set's score and its result slide use the alternatives' own `correct` flag and are right.

### Suggested fix

Pass the stored index: `self.createXApiAnsweredEvent(self.options.choices[index], self.userAnswerIndex[index], duration)`.
`userResponses` is still needed as it is for restoring a view (`getCurrentState`).

### Our workaround

Our xAPI bridge (the script that forwards statements to our server) reads the stored index from the set instance
that raised the event (`userAnswerIndex`) and sends that as the response, with `success` and `score` to match; when
it cannot read the record it sends no answer for the statement (`packages/hvl-h5p-theme/src/xapiSingleChoiceSet.js`,
D-151). Our test `apps/server/e2e/singleChoiceSetInsight.e2e.test.ts` plays a set in the real library as five
learners and fails if the answers it stores stop matching what the learners chose.
