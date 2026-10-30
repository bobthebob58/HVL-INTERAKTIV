# xAPI statements of the ten real content types (probe P1)

What H5P really sends in our player, recorded by probe P1's browser tests (D-102, D-115):
`apps/server/test/h5p/xapiQuestionTypes.browser.int.test.ts` and `xapiContainerTypes.browser.int.test.ts` play each
package example (D-078) in full Chromium, as a learner, inside a same-origin host page. Step 3's unit tests of the
DATA-012 mapper, the LTI-011 schema and the LTI-010 bridge read these files instead of hand-written statements.

## Format

One JSON file per main library, named after its machine name:

- `library`: the main library and version that sent them, e.g. `H5P.MultiChoice 1.16`.
- `contentId`: always `{{contentId}}`. The activity's content ID appears only as this placeholder, also inside
  `object.id`, `?subContentId=` IDs, parents and the `h5p-local-content-id` extension.
  `readXapiFixture(type, contentId)` in `test/support/xapiFixtures.ts` puts a real one back.
- `actions`: what the learner did, one line per step.
- `statements`: in the order H5P dispatched them. Each has `view` (1 for the first page load, 2 after a reload),
  `step` (the learner step it arrived in) and `statement`, exactly as H5P built it.

No personal data: the actor is H5P's anonymous user (`{"name": "", "mbox": "mailto:"}`), and the texts are the
package examples' own Nynorsk texts. The files hold no learnerKey, host, port or timestamp. Durations are as measured
in the recording run.

## The fixtures

| File | Learner's path | What it shows |
|---|---|---|
| `H5P.MultiChoice.json` | picks the right option, «Sjekk» | root `attempted` on load; root `answered` 1/1 with `success`, response `"0"` |
| `H5P.Blanks.json` | six gaps right, the last empty, «Sjekk» | one `interacted` per changed gap; root `answered` 6/7 without `success`; the gaps joined by `[,]` with the empty one kept |
| `H5P.DragText.json` | three of four words right, «Sjekk», then a reload | root `answered` 3/4 without `success`; after the reload, three `interacted` with no context at all (no category, parent or subContentId; `object.id` and `h5p-local-content-id` are the content ID), restoring the words, before the root `attempted` |
| `H5P.QuestionSet.json` | four questions, «Avslutt» | sub `answered` per question (choice `"0[,]1"`, fill-in with an empty gap); root `progressed` per page; root `completed` 6/9 with `success`, the sum of the questions |
| `H5P.Column.json` | the package example's text and its MultiChoice **twice** (the example has one task; our test saves this two-task variant with a fixed second subContentId), first task right, second wrong | nothing on load; root `progressed` and sub `answered` per task; root `completed` 1/2 only after the second task |
| `H5P.CoursePresentation.json` | to the MultiChoice slide, «Sjekk», to the summary slide, then a reload | root `progressed` per slide; root `completed` 1/1 on the summary; in view 2, root `attempted`, `progressed` and the same `completed` again with no learner action (a replay) |
| `H5P.InteractiveBook.json` | «Les», «Sjekk» in chapter 1, to the summary page | nothing before «Les»; chapter (Column 1.22) `completed` without a parent; no root score, since reporting is off (D-115, Q18, turns it on in step 3, which then regenerates this file) |
| `H5P.ImageHotspots.json` | opens and closes three hotspots | no statements at all |
| `H5P.BranchingScenario.json` | two first alternatives to the end screen | root `attempted` and the start node on load; the BranchingQuestion's `interacted` carries no response; root `completed` 10/10 without `success` |
| `H5P.InteractiveVideo.json` | plays to the question at 3 s, «Sjekk» | root `attempted`; sub `attempted` and `answered` with the ending-point extension; no root score and no `progressed` |

## Regenerating

After an upgrade of H5P Core or a content type, the tests fail with "no longer matches the player". Then run, from
`apps/server`:

```sh
XAPI_FIXTURES_WRITE=1 npx vitest run test/h5p/xapiQuestionTypes.browser.int.test.ts test/h5p/xapiContainerTypes.browser.int.test.ts
```

The test writes plain `JSON.stringify` output; format it with `npx prettier --write test/fixtures/xapi` (the commit
hook does it too), then review the diff and the step 3 unit tests that read the files before committing.
