# Record: branching paths in insight (`INS-004`)

| | |
|---|---|
| **Status** | Built on 2026-11-28 (step 38, D-154). The owner chose to build it and approved the design that day, after the probe |
| **Requirement** | Spec 05 `INS-004`: for BranchingScenario, the distribution of choices at each decision node and how many learners used a retry path |
| **Decisions to read first** | D-154 (the probe, the bridge's `SPEC-DEVIATION` from `LTI-010`, the view, the privacy rules), D-102 (the bridge, learners only), D-106 and its amendments (suppression, additive groups), D-115 (probe P1), D-137 (a changed answer key) |
| **Privacy input** | [docs/privacy/DPIA-INPUT.md](../privacy/DPIA-INPUT.md) §12, residuals R42 and R43, and question 9 of its §13 |

## What was built

For a Branching Scenario the **Innsikt** tab has the part «Val ved kvar avgjerd»: per decision (a BranchingQuestion
node), how many learners chose there («Studentar som valde»), how many chose each option **the first time** they met
the decision, and how many **chose again** there, through a loop, the back button or a new run («Valde på nytt»). Groups under *k* are
hidden as elsewhere («< 5»; a decision's options are one additive group). The CSV has the same figures (section
`decisions`, measures `choosers`, `firstChoice`, `choseAgain`). The figures are for the current version only, and the
current content's decisions are in no row of the question list (`INS-002`); a decision that was removed is, in a
view of an older version, a row without a name like any removed question. A decision's options, their whole texts
in order, are part of the answer key: a save that rewords an option, or swaps two that lead to the same node, starts
a new version and keeps progress (D-137). Adding, removing or re-pointing an option is a structural save, as
before: it asks first and resets progress (D-093).

## The option taken

A variant of the old note's option A, "a statement the bridge makes": the bridge does not compose a statement, it
sends the one H5P made and kept. Options B (read the saved learner state) and C (wait for upstream) were not taken.

## What the probe found (2026-11-28)

H5P.BranchingScenario 1.10.1 with H5P.BranchingQuestion 1.0, in Chromium. P1 stands: a choice dispatches `interacted`
without a response, and the last choice before an end screen dispatches nothing. But the scenario keeps the
question's own `answered` statement for every choice last on its list `xAPIData` (interaction type `choice`, the
node's `subContentId`, the option's index as `result.response`), and fires its own `navigated` event with
`chosenAlternative`. A choice made again is a new entry; the back button and a resume after a reload add no choice
(they can add a page's own entry, which is never sent); a restart empties the list.

## Where it is

- Browser: `packages/hvl-h5p-theme/src/xapiBranchingChoices.js`, the bridge's fifth player-only script, hands
  `xapiBridge.js` the kept statement's verb, object and context with the index alone (not the time spent at the
  decision), and the bridge cuts and queues it like a dispatched one (`SPEC-DEVIATION: D-154`, from `LTI-010`
  only). The server stores it with the schema, rules and table it had: no migration, no new column.
- Server: `apps/server/src/insight/content/branchingDecisions.ts`, `insight/aggregate/branchingChoices.ts`, the field
  `branching` in `insight/insightReport.ts` and `buildInsightReport.ts`, the CSV rows in
  `insight/export/insightCsvRows.ts`, the answer key in `insight/content/answerKeys.ts`; the contract in
  `packages/api-contract/src/insightReport.ts`.
- Web: `apps/web/src/features/insight/BranchingSection.tsx`, texts under `insight.branching.*`, `ScrollTable`'s `fit`.
- Tests: `packages/hvl-h5p-theme/test/xapiBranchingChoices.test.ts`;
  `apps/server/test/h5p/xapiBranchingChoices.browser.int.test.ts` (the probe kept as an `upstream pin:`, and what the
  bridge sends through a loop, the back button, a reload and a restart);
  `apps/server/test/insight/branchingChoices.test.ts`, `branchingDecisions.test.ts`,
  `branchingSuppression.property.test.ts` (the hand-calculated fixture
  `fixtures/twentyDeciders.ts`, described in `fixtures/README.md`); `apps/server/e2e/branchingInsight.e2e.test.ts`;
  `apps/server/a11y/axeInsightBranching.a11y.test.ts`; `apps/web/test/features/insight/InsightBranching.test.tsx`.

## What stays open

- **The DPO:** residuals R42 and R43 and question 9 in [docs/privacy/DPIA-INPUT.md](../privacy/DPIA-INPUT.md). R42:
  the learners of a part reached through one option only, less the earlier decision's «Valde på nytt», bound that
  option's hidden cell; nothing in the code closes it. R43: one pseudonym's path can be put together from the
  stored rows (not from any view), and a choice in a dilemma can show an attitude.
- **Upstream:** the report draft `docs/upstream/h5p-branching-scenario-choice-statement.md`, asking H5P to dispatch
  the choice. The script depends on the library's internals; another version that keeps its record elsewhere sends
  nothing, so a decision then shows no learners, never a wrong count.
- **By design:** no view of one learner's path, no figure across two decisions, no time of a choice.
- **Earlier plays:** plays before the change have no stored choices, so their decisions show no learners.
