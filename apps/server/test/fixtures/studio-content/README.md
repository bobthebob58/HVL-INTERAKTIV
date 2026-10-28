# Studio content fixtures (`PED-001`, D-082)

Each folder is a content folder laid out like the repository's `content/`, so a test can pass it to
`loadStudioContent(root)` or `npm run content:check -- --root=<folder>`. `renamed-label/` is valid. Every other
folder is broken on purpose by one defect in its `phases.yaml` (its `references.yaml` is valid), except
`problems-in-both-files/`, which has three across both files. Line numbers in the tests refer to these files: change
a file, and update the test's expected line.

| Folder | What is in it | Expected result |
|---|---|---|
| `renamed-label/` | Valid phases and references; the forarbeid label is renamed «Førebuing» / «Forberedelse» / «Preparation» | loads; the loaded label is the new one (a rename needs no code change) |
| `missing-language/` | The underveis (`Mellomarbeid`) label has `nn` and `en` but no `nb` | refused: `phases.yaml:38`, key `phases[underveis].label.nb`, "the nb text is missing" |
| `unknown-key/` | The forarbeid phase has a key `colour: blue` the schema does not know | refused: `phases.yaml:19`, key `phases[forarbeid].colour`, "is not a known key" |
| `repeated-key/` | The etterarbeid label gives `nn` twice | refused: `phases.yaml:59`, key `phases[etterarbeid].label.nn`, "appears more than once" |
| `wrong-phase-key/` | The second phase has the key `undervegs` instead of `underveis` | refused: `phases.yaml:35`, key `phases[undervegs].key`, "is not a phase key" |
| `problems-in-both-files/` | The anchor description has no `en`; references.yaml has a key in capitals (`Guo2014`) and a reference without `verify` | refused with all three problems in one error, ordered by file and line |

The guide, pattern and portfolio loaders read no files yet; when they do, `loadStudioContent(<fixture>)` also reports
their missing files, so a test checks only the problems in the file it is about. A test that shows a renamed label
reaching a page, the planner or the portfolio does not load `renamed-label/` in full: it uses
`studioContentWithRenamedLabel()` from `test/support/renamedPhaseLabels.ts`, which is the real `content/` with this
folder's phases, so no workstream has to copy its files here.
