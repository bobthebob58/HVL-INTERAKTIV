# Draft: H5P issue, Branching Scenario dispatches no xAPI statement that says which alternative was chosen

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-branching-scenario` (the question library is `h5p/h5p-branching-question`) |
| **Channel** | A public GitHub issue on that repository, with H5P's Feature Request or Bug Report form (see the README) |
| **Status** | Needs the owner's check: only the pinned versions were read and run; newer releases (Branching Scenario 1.11.x) were not read, so they may already do this |
| **Our records** | D-154, D-115 (probe P1), PROGRESS step 38; the `UPSTREAM:` tag in `packages/hvl-h5p-theme/src/xapiBranchingChoices.js` |
| **Checked** | 2026-11-28: H5P.BranchingScenario 1.10.1 (pinned, commit 6860e97e) and H5P.BranchingQuestion 1.0 (pinned, commit daad55fc), read and observed in Chromium |

---

## Title

Branching Scenario: no xAPI statement is dispatched for a choice in a branching question; the `answered` statement exists only in `getXAPIData()`

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium, through Playwright 1.65.1)
- **Operating system:** Linux, Ubuntu 24.04

### Versions

- H5P.BranchingScenario 1.10.1 (commit 6860e97e) with H5P.BranchingQuestion 1.0 (commit daad55fc).
- H5P Core 1.28.0; Nynorsk, though the language does not matter.

### Steps to reproduce

1. Create a Branching Scenario with a text, a branching question with two alternatives that each have a feedback
   text, and a second branching question whose alternatives end the scenario.
2. Listen for xAPI statements: `H5P.externalDispatcher.on('xAPI', (event) => console.log(event.data.statement))`.
3. Play it: choose an alternative of the first question, go on from its feedback, and choose an alternative of
   the second question.

### Expected

For each choice, a statement that says which alternative was chosen: an `answered` about the branching question
(its `subContentId`), with `result.response` the alternative's index, as other question types dispatch when they
are answered.

### Actual

- A choice whose alternative has a feedback screen dispatches `interacted` about the question, with no `result`.
- A choice that ends the scenario dispatches nothing about the question; only the scenario's `progressed` and
  `completed` follow.
- So no dispatched statement says which alternative a learner chose. A system that receives H5P's statements
  cannot tell how the learners' choices are spread over the alternatives of a decision.

### What the libraries already have

The question makes exactly that statement, for the report contract only. `branchingQuestion.js`:

```js
self.getXAPIData = function () {
  var xAPIEvent = this.createXAPIEventTemplate('answered');
  addQuestionToXAPI(xAPIEvent);
  xAPIEvent.setScoredResult(undefined, undefined, self, true);
  xAPIEvent.data.statement.result.response = answered;
  ...
```

and the scenario collects it when the learner leaves the node (`h5p-branching-scenario.js`, the `navigated`
handler):

```js
const xAPIData = this.libraryScreen.getXAPIData(this.currentId);
...
if (xAPIData && (!isBranching || isBranchingQuestionAndAnswered)) {
  this.xAPIData.push(xAPIData);
}
```

A choice made again (after a loop back to the question, or after the back button) is pushed again, so the list
holds every choice in order. The scenario's own `navigated` event also carries `chosenAlternative`.

### Suggested change

Dispatch the question's `answered` statement when an alternative is chosen (or when the scenario collects it), for
example `self.trigger(xAPIEvent)` in the branching question, or `this.trigger(...)` with the collected statement
in the scenario's `navigated` handler. The statement is already built; only the dispatch is missing.

### Our workaround

Our xAPI bridge (the script that forwards statements to our server) listens to the scenario instance's
`navigated` event and, for a move with `chosenAlternative`, sends the statement the scenario has just put last on
`xAPIData` (`packages/hvl-h5p-theme/src/xapiBranchingChoices.js`, D-154). It reads two internals of the library,
so our test `apps/server/test/h5p/xapiBranchingChoices.browser.int.test.ts` plays the real libraries and fails,
with the words «upstream pin», if they stop keeping that statement or start dispatching an `answered` themselves;
the workaround goes when a pinned Branching Scenario dispatches it.
