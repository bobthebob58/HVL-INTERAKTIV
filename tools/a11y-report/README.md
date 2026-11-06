# tools/a11y-report

## Purpose

Writes the WCAG 2.2 conformance report, [`docs/accessibility/WCAG-CONFORMANCE-REPORT.md`](../../docs/accessibility/WCAG-CONFORMANCE-REPORT.md)
(`UD-040`, spec 03 §6; decision D-079, amendment of 2026-11-05). For each of the 56 WCAG 2.2 Level A and AA success
criteria it regenerates the automated parts: the axe rules that test it (from axe-core's own tags, under the suite's
tags), our own checks with their views, the result of the last full run of `npm run test:a11y`, links to the tests,
the manual protocol's steps and page checks, and the entries of the H5P upstream register with their links. It never
writes the manual parts: the verdict and manual evidence of each criterion, and the sections on scope, the
assistive-technology runs, the cognitive review, the barriers axe cannot see and the uustatus.no notes. Those stand
between the HTML comments `manual:start <name>` and `manual:end <name>`, and the generator copies them byte for byte.
It stops, writing nothing, on a broken or unknown block (a marker in other letter case included), a missing, doubled
or unknown verdict, a verdict other than *Not yet determined* without a dated `**Evaluated by HVL:** YYYY-MM-DD`
line, a protocol step that does not exist, or a check that matches no test.

A run enters through a distilled, committed summary, [`docs/accessibility/automated-run.json`](../../docs/accessibility/automated-run.json):
titles and statuses, and axe findings counted by rule and impact, with the run's date and commit and no other time.
So a fresh checkout regenerates the report without Chromium, and an unchanged tree gives the same file.

## How to run

```bash
npm run a11y:report                                # rewrite the report from the committed summary
npm run a11y:report -- --check                     # exit 1 when the committed report is not what its sources give
npm run a11y:report -- --from-run=<dir>            # record a run first: <dir>/vitest.json and <dir>/axe-reports.jsonl
npm run a11y:report -- --run                       # run the suite (needs npm run build and the services), record it
npx vitest run tools/a11y-report                   # the [UD-040] tests
```

To record a run by hand (CI's `a11y-report` artefact holds the axe lines; add Vitest's JSON report):

```bash
dir=$(mktemp -d)   # a new, empty folder: the suite appends to axe-reports.jsonl, so an old file would count twice
A11Y_REPORT_DIR="$dir" npm run test:a11y -- --reporter=default --reporter=json --outputFile.json="$dir/vitest.json"
npm run a11y:report -- --from-run="$dir"
```

Only a run of the whole suite is recorded: a run that lacks a suite file with running tests (one file, or a `-t`
filter that leaves a file out) is refused, and nothing is written. A file Vitest marks failed (a failed test, or a
`beforeAll` or an import that failed, which leaves its tests skipped or unlisted) is recorded as failed and named in
the report, and `--from-run` and `--run` then exit 1. The tree counts as clean only when `git status --porcelain`
shows nothing, untracked files included.

Regenerate in the same commit when a test whose title opens with a mapped ID is added, renamed or removed, when the
protocol, the register or the results folder changes, or after a full run, as with `docs/TRACEABILITY.md`.

## Folder structure

| Path | Responsibility |
|---|---|
| `a11yReport.mjs` | The command: flags, recording a run, writing or checking the report |
| `buildReport.mjs` | Loads the sources and composes the report from them and the committed manual blocks |
| `wcagCriteria.mjs` | The 56 criteria in WCAG's order |
| `evidencePerceivable.mjs` (1.1–1.3), `evidenceDistinguishable.mjs` (1.4), `evidenceOperable.mjs` (2.1–2.3), `evidenceNavigable.mjs` (2.4–2.5), `evidenceUnderstandableRobust.mjs` (3, 4) | The reviewed map from each criterion to our checks, protocol steps and scope notes, by WCAG guideline |
| `evidenceShapes.mjs`, `criterionEvidence.mjs` | The two kinds of check, and the joined map with its completeness check |
| `axeRuleIndex.mjs` | Which axe rules the suite runs for each criterion, read from axe-core |
| `testIndex.mjs` | Finds the running tests of each check by the IDs that open their titles |
| `runSummary.mjs`, `runResults.mjs` | Distils a run into the committed summary, and reads results from it |
| `manualBlocks.mjs` | Reads, checks and seeds the manual blocks |
| `protocolIndex.mjs`, `upstreamEntries.mjs` | The protocol's steps and page checks and the dated results; the upstream register with its links |
| `renderCriterion.mjs`, `renderSections.mjs`, `renderReport.mjs` | One criterion's section; the summary, results, register and appendices; the whole report |
| `test/` | The `[UD-040]` tests |

## Changing the evidence map

Which test speaks to which criterion is a judgement, so it is code that is reviewed. A check names the IDs its tests'
titles open with (`suiteCheck` for `apps/server/a11y/`, `testCheck` for every other test, linked under the command
that runs it: `npm test`, or `npm run test:e2e` for `apps/server/e2e/`), what it checks and, for the suite, the
views; `contains` and `path` narrow it. A `note` states a fact about scope, never a verdict: no verdict is derived
from the automated results (protocol §1).
