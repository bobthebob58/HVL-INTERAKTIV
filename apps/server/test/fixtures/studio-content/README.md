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

The guide and portfolio loaders read no files yet; when they do, `loadStudioContent(<fixture>)` also reports their
missing files, so a test checks only the problems in the file it is about. The pattern loader finds no
`laeringsdesign/patterns/` folder in these, which is no patterns, not a problem. A test that shows a renamed label
reaching a page, the planner or the portfolio does not load `renamed-label/` in full: it uses
`studioContentWithRenamedLabel()` from `test/support/renamedPhaseLabels.ts`, which is the real `content/` with this
folder's phases, so no workstream has to copy its files here.

## `pattern-fixture/` (`PED-010`, `PED-011`, `PROD-001`, `PROD-009`)

A partial content folder: only `laeringsdesign/references.yaml` (one reference, `fixture2026`, which only this
fixture cites) and `laeringsdesign/patterns/fixture-check/`, one pattern made the way ALU makes one (D-084). It is
read with `loadPatternContent` through `test/support/fixturePattern.ts`, never with `loadStudioContent`, so it needs
no copy of the other sections' files; `studioContentWithPatterns()` puts its patterns into the real `content/` for an
app that should offer them.

| File | What it represents |
|---|---|
| `fixture-check/pattern.yaml` | A pattern with two phases (listed out of order, `etterarbeid` before `forarbeid`) and two content types, every text in nn, nb and en, one citation, and fifteen token texts, each a guidance placeholder `⟦…⟧` |
| `fixture-check/skeleton.H5P.QuestionSet.json` | QuestionSet 1.21 with a MultiChoice 1.16, a Blanks 1.14 and a TrueFalse 1.8 question, each with a sub-content title; retry and solutions on, an informative pass mark of 80 %, no time limit; TrueFalse's feedback is a field with a length limit (2 048) |
| `fixture-check/skeleton.H5P.Blanks.json` | Blanks 1.14 with guidance inside a blank (`*{{blanksAnswer}}*`) |

The fixture loads as written, with and without the installed libraries. The loader tests copy it to a temporary
folder and add one mistake each (a missing language, an unknown key, a token without a text, a wrong library
version, a text too long for its field, `:` in a blank), so no broken copy is kept here. The creation tests offer it,
and a variant whose TrueFalse names a version that is not installed (`fixture-unavailable`), in the whole app on the
real libraries; the route's permission matrix offers it on the `/api` router without the H5P engine.
