# Design note: the light simplification check

| | |
|---|---|
| **Status** | Planned as S6's step 10 "if time allows; otherwise carried to the pilot list" (PROGRESS). Check PROGRESS: if S6 did it, this note is a description of what was done and what a second round would look at |
| **Owner decisions** | 2026-10-24 and 2026-10-25 (the S4+ pass and its method); PROGRESS, S6 step 10 |
| **Precedent** | The S4+ pass: 59 changes, 569 lines shorter, every test kept, two independent skeptics per proposal, the S4 gate green again (PROGRESS, «S4+») |

## Why it fits your project

The code was written by an AI assistant across six sessions and many parallel workstreams. That leaves signs a careful
human would not: comments that restate the code, checks repeated where one layer already guarantees them, generic or
overlong names, boilerplate copied between files, abstractions with one user, and idioms that differ from file to file
because different agents wrote them. Finding them is a code review; telling them apart from code that is unusual
because it is right is the hard part.

## Method (as the owner decided)

1. **Propose,** one change at a time, with the file, the lines and the reason. No behaviour change: the public
   behaviour, the API, the logs and the stored data stay the same.
2. **Two independent skeptics per proposal** (two of you, or you and a tool) try to show that it changes behaviour or
   loses a guarantee. A proposal survives only if both fail.
3. **Keep every test.** A test may move or be renamed with its requirement ID; none is deleted to make a change pass.
4. **Run the area's tests, then the full gate** (the Evaluator Guide §5) after the round.
5. **An HVL developer reads a sample** afterwards and has the last word.

## Unfamiliar but correct: leave it, and explain it

Some code looks odd because it is right. Do not make it ordinary; give it a short `WHY:` comment a human maintainer can
follow instead. Examples you will meet:

- Security checks that look redundant but guard a different path (`SECURITY:` tags: the ltik check on every use, not
  only at launch, D-050; the SVG checks on both upload paths, D-044).
- H5P and Lumi workarounds (`UPSTREAM:` tags; D-080's run-time accessibility repairs, D-111's language overlay).
- Timing guards in the browser tests and the editor's save readiness (D-113's red-`main` fix).
- The materialized CTE in the grade worker's claim, which looks like an over-complicated `UPDATE … WHERE id IN (…)`
  and is there because PostgreSQL may rescan the subquery (PROGRESS, S6 step 3).
- Suppression code that hides more than *k* seems to require (D-106's amendments).

## How to record it

Each accepted change in a pull request with the proposal, both skeptics' attempts and the gate's result; a line in
PROGRESS's session log. A pattern you find in many files (one idiom written three ways) is better fixed by a decision
that names the one way, then a change per area.
