# Design note: how fresh insight is (Q24)

| | |
|---|---|
| **Status** | Built as the default; the alternative is not built. Q24 is open for the owner and ALU |
| **Requirements** | `INS-001`, `INS-006`, `PROD-010`, `MAPPE-003` |
| **Decisions to read first** | D-106 and its amendments of 2026-11-04 and 2026-11-05 (periods end at the latest Oslo midnight; the mappe reads the same rows), D-107 (the academic year) |
| **Code to read first** | `apps/server/src/insight/scope/insightPeriod.ts`, `insight/data/insightStatements.ts`, `learningDesign/mappe/storedActivityResults.ts`; tests `insightPeriodEnd.int.test.ts`, `storedResultsBeforeToday.int.test.ts` |
| **Privacy input** | [docs/privacy/DPIA-INPUT.md](../privacy/DPIA-INPUT.md), residuals R3 and R8 |

## The problem

Suppressing groups under *k* = 5 protects one view. Two views of the same activity a few minutes apart, where only one
known learner played in between, show exactly what that learner did (differencing). The step-4 privacy review found
this; D-106's amendment closed it by ending every period at the latest midnight in Oslo, so all views on one day are
the same and the **Innsikt** tab says «Tal til og med i går».

What remains: two views on consecutive days still differ by one day's learners, and a teacher who wants to see this
morning's answers before a seminar the same day sees them tomorrow. That is Q24.

## Options

| Option | Behaviour | For | Against |
|---|---|---|---|
| **Keep the daily view** (the default, built) | Data up to and including yesterday | Simple; already tested; same rule for the mappe and the CSV | Same-day preparation is impossible; a quiet day with one learner still differs from the day before by that learner |
| **Release a new view after *k* new learners** | Each context's view moves forward only when at least *k* learners not in the last view have played since its cut-off | Closes the day-by-day difference too: two consecutive views always differ by at least *k* learners | A small course may see no new numbers for days; the cut-off must be stored and explained to teachers |

## If the owner and ALU choose the release rule

- **Store the cut-off**, per platform-scoped context and activity (D-103), as the moment of the last release; no
  learner data. A job (or the request itself, under a lock) moves it forward when the count of distinct learners with
  stored statements after it reaches *k*. Test users are not counted (D-102's amendment); learners across 1 August
  are not one learner (D-107), so a cut-off never crosses the academic-year boundary.
- **Every reader uses the cut-off,** not midnight: the tab, the CSV (`INS-009`), the shortlist and the mappe's results
  (D-095), or the mappe less insight will difference them again (the step-5 review found exactly that once).
- **Say so in the UI,** in `nn`, `nb` and `en`: «Tal til og med <tidspunkt>» and why a view has not moved.
- **Decide first:** an amendment to D-106 (and D-095 for the mappe), the DPIA residuals R3 and R8 rewritten, and the
  privacy notice's text.

## Tests it needs

- Property tests (fast-check, as `insightSuppression.property.test.ts`) that any two consecutive releases differ by at
  least *k* learners, and that a view never includes a statement stored after its cut-off.
- Integration tests with the injected clock (`jobClock.ts`): no release below *k* new learners, a release at *k*, none
  across 1 August, test users ignored; the CSV and the mappe follow the same cut-off.
- The **Innsikt** tab in the accessibility suite with the new note.
