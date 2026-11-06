# Design note: branching paths in insight (`INS-004`)

| | |
|---|---|
| **Status** | Not built (SHOULD). Deferred by D-115 (probe P1, 2026-10-30) and passed on by D-101 |
| **Requirement** | Spec 05 `INS-004`: for BranchingScenario, the distribution of choices at each decision node and how many learners used a retry path |
| **Decisions to read first** | D-102 (the bridge, learners only), D-106 and its amendments (suppression, periods, additive groups), D-115 (what H5P really sends) |
| **Code to read first** | `packages/hvl-h5p-theme/src/xapiBridge.js`, `xapiStatements.js`; `apps/server/src/xapi/`; `apps/server/src/insight/aggregate/`, `insight/suppression/`; the probe `apps/server/test/h5p/xapiContainerTypes.browser.int.test.ts` |

## What probe P1 found

BranchingScenario does not tell the outside world which choice a learner made. Its branching question sends an
`interacted` statement **without a response**; the choices exist only in the content type's `getXAPIData()` and in its
saved state; and the last choice before an end screen sends nothing at all. So no stored statement can say "at node 3,
7 learners chose B". D-115 also notes that `uv-case` scores 10 of 10 on every path (Q19), so the score says nothing
about the path either.

## Options

| Option | How | For | Against |
|---|---|---|---|
| **A. A statement the bridge makes** (recommended, after a probe) | When a branching question is answered, the bridge reads the choice from the content type (its `getXAPIData()` or the event's target) and adds a `response` to the statement H5P sent, or sends one statement of its own, marked as bridge-made | Stays inside the existing pipeline: learners only, batching, replay rules, `academicYear`, the purge | A `SPEC-DEVIATION` from `LTI-010` and `LTI-011` (statements are H5P's own today); depends on BranchingScenario's internals (`UPSTREAM:`), so the probe must pin them |
| B. Read the saved learner state on the server | The resume state (`PROD-008`) holds the path | No change in the browser | Uses state kept for resuming for a second purpose (a DPIA question, `DATA-012`); the state's format is internal to H5P and changes with versions |
| C. Ask upstream to send the response | A report to H5P (D-112's channel) | The right fix | Months at best; nothing for the pilot |

## Before any code

1. **A probe, kept as a test,** in the manner of `xapiContainerTypes.browser.int.test.ts`: play `uv-case` and one
   activity with a retry path in full Chromium as a learner; record what `getXAPIData()` gives at each node, whether a
   retried choice is kept or replaced, and what the end screen sends. D-115 requires this before a decision.
2. **A decision** (or an amendment to D-102 and D-115): the statement's shape, the marker, the caps, and the
   `SPEC-DEVIATION`. Spec 05's `INS-004` note then points to it.
3. **The privacy rules:** each node's choices are one additive group under D-106's rule (a hidden count must not be
   recoverable from the node's total or from the next node's counts); a retry count is a count of learners, suppressed
   below *k*; the paths of one learner are never shown. Ask whether the DPIA input needs a new residual.

## Tests it needs

- The probe above (an `upstream pin:` where it pins H5P's behaviour, DOC-004).
- Unit tests of the aggregator, with hand-calculated fixtures, and fast-check property tests that no hidden count can
  be worked out from what is shown (as `insightSuppression.property.test.ts` does).
- The bridge's own tests (`packages/hvl-h5p-theme/test/`), the ingestion's (`apps/server/test/xapi/`), an end-to-end
  test through `/app/play`, and the **Innsikt** tab in the accessibility suite.
