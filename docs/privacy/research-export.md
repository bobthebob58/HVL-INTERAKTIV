# Research export: design only

| | |
|---|---|
| **Status** | Design, 2026-11-05. **Nothing is built**, and nothing may be built or exported before the precondition below is met. Not a requirement yet: no spec ID or decision covers it |
| **Origin** | The owner's idea of 2026-10-26 (PROGRESS, S6 step 5): researchers at ALU and Pedagogisk akademi analyse learning data in Python or R, beside the system, while everything inside the product stays TypeScript |
| **Precondition** | Research is a purpose of its own, outside teaching ([DPIA-INPUT.md](DPIA-INPUT.md) §2). It needs its own legal basis and the approval of HVL's data protection officer (DPO) before anything is built (Q6, Q25) |
| **Related** | [DPIA-INPUT.md](DPIA-INPUT.md), [DATA-INVENTORY.md](DATA-INVENTORY.md), spec 05 (`INS-006`, `DATA-002`, `DATA-003`, `DATA-010`, `DATA-012`), D-095, D-106, D-107, D-108, D-109 |

## 1. The idea in one paragraph

HVL operations run a command on the server that reads the stored learning data, under the same privacy rules as the
product, and writes a **research package**: CSV files with a documented format, a machine-readable schema and a
manifest. Researchers never touch the live database and never see a pseudonym the system uses. The exporter is built
and tested in TypeScript next to the insight and purge code it reuses; the analysis happens in Python or R, in an
example notebook the package documents. Each package answers one approved research question and holds only the
fields that question needs.

## 2. Precondition: legal basis and approval

Before a decision is recorded or code written:

1. **The DPO's assessment** of the purpose and its basis. Research is a new purpose for data collected for teaching.
   GDPR Art. 5(1)(b) treats further processing for scientific research as compatible only with the safeguards of
   Art. 89(1); Art. 6(1)(e) with Norwegian law's provisions for research is a likely basis, consent a less likely one,
   because students depend on HVL *(DPO to decide; verify the Norwegian provisions)*.
2. **Anonymous or not.** Packages of tiers A and B (§3) hold only aggregates suppressed below *k* and are designed to
   be anonymous (recital 26), but whether they are is the DPO's assessment, not this design's. Tier C holds
   pseudonymous rows about individual learners and is personal data in any case.
3. **For tier C:** the research project's own notification and assessment through HVL's research routine *(verify:
   HVL's routine and whether Sikt's notification form applies)*, an update of the DPIA input, information to learners
   (Art. 13 or 14), a storage place approved for research data, and a date by which the package is deleted. Because
   the references cannot be mapped back (§5), neither HVL nor the researchers can find one person's rows in a delivered
   package, so an access, erasure or objection request (D-108, DPIA input R34) does not reach it; the DPO decides
   whether Art. 11 and the research derogations of Art. 89(2) and Norwegian law cover that, and learners are told.
4. **Teachers are data subjects too.** An activity, a course code or a course ID can point to the teacher who made or
   teaches it. Every tier therefore replaces them with references local to the package (§5), and titles and texts stay
   out unless the order names them and the DPO approves.
5. **Then:** a decision in `docs/DECISIONS.md` and a new `DATA` requirement in spec 05 (its ID chosen then), an update
   of the DPIA input and the inventory, and only then the code. Each export order (§4) is approved on its own.

**Today's nearest thing.** The read-only role `hvli_analytics` (D-109) can read `analytics.insight_snapshot`: the
yearly purge's *k*-suppressed snapshots, with the real activity and course IDs. Giving that role to a researcher is
already research use; the DPO should treat it under the same precondition (DPIA input R25).

## 3. Three tiers

| Tier | What it holds | Learner data | Typical questions |
|---|---|---|---|
| **A: activity aggregates** | Per activity, course, content version and semester: learners started and completed, completion rate, median attempts, median time on task (`INS-001`), the mappe's change between first and latest attempt (`MAPPE-002`) | None: groups below *k* left out, values hidden by `INS-006`'s rules and D-095's two-sided rule (§5) | Do etterarbeid activities get completed more often than forarbeid ones? Does a pattern's completion depend on its estimated minutes? |
| **B: item aggregates** | Per question, in the same groups as tier A: learners, share right on the first and the latest attempt (`INS-002`); per choice option, how many chose it (`INS-003`), suppressed as insight suppresses them | None: as insight's tab, with the two-sided rule for shares (§5) | Which kinds of questions improve most between first and latest attempt? |
| **C: re-keyed events** | One row per stored statement of the approved activities: a package-local learner reference, activity, question, verb, day, order, attempt reference and the score fields | **Pseudonymous rows** | Does spacing between plays relate to the latest score? (needs one learner's sequence) |

The recommendation is A and B first. Tier C only for a question A and B cannot answer, with the stricter process of
§2 point 3.

## 4. The export order

A JSON file that operations receive with the DPO's approval and pass to the command. The command refuses an order that
breaks any rule; it never guesses.

| Field | Meaning | Rule |
|---|---|---|
| `approval` | The DPO's case reference (and the research project's, for tier C) | Required; written to the manifest and the audit event; never personal data |
| `question` | One sentence: the research question | Required; copied into the package's README |
| `tier` | `A`, `B` or `C` | Tier C needs `projectReference` and `deleteBy` |
| `academicYears` | Which stored years (`academicYear`, D-107) | Only years whose rows still exist: row-level data are purged each 31 August, so tiers B and C must be exported before then; tier A of older years comes from the purge's snapshots, which hold only the mappe's figures (participants, completion rate, median attempts, mean change; D-107) for the whole year |
| `activities` | A selection: by content type, læringsdesign phase, pattern, course code, or a list of activity IDs | At least one rule; IDs never leave the server (§5) |
| `fields` | The columns wanted, from the tier's allow-list (§6) | Nothing outside the list; every field named must be needed by the question |
| `k` | The minimum group size | At least the product's `MIN_GROUP_SIZE` (5); a higher value may be set |
| `deleteBy` | When the researchers delete the package | Required for tier C; recommended for all |

## 5. Rules the exporter enforces

- **Only learners' data the product keeps:** rows with `testUser = false` (D-102), of the ordered academic years only,
  never an author's preview (never stored, D-102). Each semester reads only rows whose `academicYear` is that
  semester's year, as insight and the mappe do (D-106's amendment of 2026-11-04), so a learner of the 1 August tail is
  never two learners under two years' keys.
- **No identifier of the system leaves the server:** no `learnerKey`, `contentId`, `contextId` (D-103's string),
  statement ID, `attemptId`, `subContentId`, user or account ID, Feide ID or `sub`. Activities, courses, questions,
  options and (tier C) learners and attempts get references local to the package (`A01`, `C01`, `Q001`, `L0001`, …),
  assigned in random order from a key made for this export in memory and discarded when it ends. Two packages cannot be
  joined, and nobody can map a reference back to a row, also not HVL.
- **No text:** titles, question texts, feedback texts and gap answers stay out. A gap answer is replaced by whether it
  was right; a choice by its option reference and whether it is right. An order may ask for question texts only when
  the DPO approves that they hold no personal data (DPIA input R31).
- **Fixed groups:** every value in tiers A and B belongs to one activity, course, content version and semester, the
  groups insight and the mappe count (D-095's amendment of 2026-11-04, D-106). A package never sums across courses,
  versions or semesters, because such a total less a group someone sees elsewhere (a teacher's own course in
  insight) would give the rest, which can be a group the rule hides (D-106's "all contexts minus one").
- **Group size:** every group below *k* learners is left out (as the mappe's rules do, D-095); tiers A and B hide
  values with insight's suppression core (`insight/suppression/`, D-106 and its amendments), including complementary
  suppression and the parts another value gives away. A course with fewer than *k* learners in the selection is left
  out of tier C entirely.
- **Two-sided rule for rates and shares:** stricter than insight (DPIA input R4, R6), because a package leaves HVL. A
  completion rate is shown only when completers and non-completers each number at least *k*, and a share right only
  when right and not right each do (D-095's two-sided rule, applied to shares as well), so a 0 % or 100 % and a small
  count behind a share stay hidden. Option counts follow insight, so an option every learner in a group chose is
  visible; whether that is acceptable outside HVL is the DPO's call (R4).
- **Coarse time:** dates only, never times of day; tier C gives a day number counted from the first day of the
  semester, and an order within the learner's plays of an activity. No `durationMs` (D-115: H5P's durations are not
  comparable).
- **Small numbers stay hidden in totals too:** the manifest gives how many rows and groups were left out, never
  a count below *k*.
- **One run, audited:** a dry run (the default) prints what would be written and left out, as counts; `--confirm`
  writes the package. Every run writes an audit event `research.export` (`DATA-007`), target a random export ID,
  details the tier, the approval reference, `k`, the years and the counts. No data, keys or references.
- **The output never lands in a terminal or a log:** like the data-subject CLI (D-108's amendment of 2026-11-05), it
  writes only to a directory, created with `umask 077`, and refuses a terminal; it writes no log lines with data.
- **Run by HVL operations** on the server host, as the purge and data-subject CLIs are; never an HTTP route.

## 6. The package format

A directory (or a `.zip` of it) per export:

| File | Content |
|---|---|
| `README.md` | Generated: the question, the tier, the approval reference, the rules in §5 in plain words, the data dictionary, how to cite, the delete-by date |
| `manifest.json` | `exportId` (random), `created` (date), `tier`, `k`, `academicYears`, `approval`, `schemaVersion`, and per file its SHA-256 and row count; how many groups and cells were left out or hidden |
| `datapackage.json` | A [Frictionless Data Package](https://specs.frictionlessdata.io/data-package/) with a Table Schema per CSV: field names, types, descriptions, constraints and `missingValues: [""]` |
| `activities.csv` | `activity_ref`, `content_type` (e.g. `H5P.MultiChoice`), `phase` (`forarbeid`, `mellomarbeid`, `etterarbeid`), `pattern_id`, `estimated_student_minutes`, `outcome_categories` (NKR) |
| `participation.csv` (A) | `activity_ref`, `course_ref`, `content_version`, `semester` (e.g. `2026H`), `started`, `completed`, `completion_rate`, `median_attempts`, `median_minutes`, `change_points`, and for each value a `<name>_suppressed` flag |
| `items.csv` (B) | `activity_ref`, `course_ref`, `content_version`, `semester`, `question_ref`, `interaction` (`choice`, `fill-in`), `learners`, `first_right_share`, `latest_right_share`, with `_suppressed` flags |
| `options.csv` (B) | `activity_ref`, `course_ref`, `content_version`, `semester`, `question_ref`, `option_ref`, `is_right`, `learners`, `learners_suppressed` |
| `events.csv` (C) | `learner_ref`, `activity_ref`, `course_ref`, `question_ref` (empty for the whole activity), `verb`, `day`, `seq`, `attempt_ref`, `scaled`, `success`, `completion` |

**Conventions:** UTF-8 without a byte-order mark; comma-separated with a header row and `\n` line ends (RFC 4180);
`snake_case` names, as `analytics.insight_snapshot` uses (D-109); decimal point `.`; shares as numbers from 0 to 1;
dates as ISO 8601 dates; an empty cell is "no value". **A hidden value is an empty cell with its `_suppressed` flag
`true`, never 0**, so a hidden count can never be read as nobody. `schemaVersion` starts at 1 and changes with any
column change; the README lists the changes.

## 7. How it would be built and tested (TypeScript)

A folder `apps/server/src/research/` beside `privacy/dsr/` and `privacy/purge/`, each file under 200 lines with one
responsibility, as everywhere (CLAUDE.md §1):

| Module | Responsibility |
|---|---|
| `researchOrder.ts` | Parses the order with zod and applies §4's rules; names a fault by its field, never by its value |
| `researchRows.ts` | Reads the selected rows in one read-only transaction, by `academicYear`, `testUser = false` |
| `researchAggregates.ts` | Tiers A and B, by calling the insight aggregators and the mappe's group rules, not copies of them |
| `researchSuppression.ts` | Applies `insight/suppression/` to every table and leaves out small groups |
| `researchReferences.ts` | The package-local references from a key made in memory per export |
| `researchPackage.ts` | Writes the CSVs, `datapackage.json`, `manifest.json` and the README |
| `researchCli.ts` | Arguments, dry run and `--confirm`, the terminal refusal, the audit event |

Tests, titled with the new requirement's ID:

- **Property tests** (`fast-check`, D-114) over random datasets: no group below *k* in any file; every value belongs to
  one activity, course, version and semester group; no rate or share shown unless both its sides number at least *k*;
  no hidden value recoverable from the totals (the same exhaustive check as `INS-006`'s); no column outside the
  order's allow-list; no cell that equals any `learnerKey`, `contentId`, `contextId`, `attemptId`, statement ID or a
  Feide-ID-shaped value in the source; two exports of the same data share no reference.
- **A golden test** on the 30-learner insight fixture: the exact files, values worked out by hand.
- **Refusals:** no approval, an expired `deleteBy`, *k* below the minimum, an unknown field, a tier C order without a
  project reference, a terminal as output; each refused before any row is read.
- **Selection:** a test student's rows, another year's rows and another activity's rows never appear, and rows under
  last year's key from the 1 August tail are in no semester group.
- **Audit:** every run writes one event without data.
- **Format:** `datapackage.json` validates against the Frictionless schema; each CSV parses strictly with the declared
  types, and each file's SHA-256 matches the manifest.

## 8. Example notebook outline (Python and R)

Delivered with the exporter as `docs/research/` *(future)*: one Jupyter notebook (Python, pandas) and one Quarto or R
Markdown document (R, tidyverse), each with pinned package versions (`requirements.txt`, `renv.lock`), and a
**synthetic sample package** generated from the test fixtures, so researchers can write and test their analysis
before any approval and without any real data (`DATA-010`).

1. **Set-up:** paths, package versions, the package's `README.md` shown.
2. **Check the package:** compute each file's SHA-256 and compare it with `manifest.json`; stop on any difference.
3. **Load with the schema:** column types from `datapackage.json` (pandas `read_csv(dtype=…, keep_default_na=False,
   na_values=[""])`; readr `read_csv(col_types = …)`); hidden values become `NA`, and a test asserts that every `NA`
   in a value column has its `_suppressed` flag set.
4. **Respect what is hidden:** never fill, impute or back-calculate a hidden value; a helper refuses to sum a column
   with hidden cells unless the analysis says why.
5. **Describe:** activities by phase, pattern and content type; participation and completion by semester.
6. **Example A:** completion rate against estimated minutes, by phase.
7. **Example B:** change from first to latest share right, by interaction type and phase (does *etterarbeid*
   retrieval practice improve?).
8. **Example C (tier C only):** spacing between a learner's plays and the latest score, with a mixed model and a
   random effect per learner (statsmodels or lme4).
9. **Report safely:** a check that every published table and figure cell rests on at least *k* learners; charts with
   labels and patterns, not colour alone (`INS-008`'s rule).
10. **Finish:** delete the package by `deleteBy` and record the deletion in the project's log.

## 9. Who decides what

| Question | Who |
|---|---|
| Is there a legal basis; are tiers A and B anonymous; may tier C exist at all | HVL's DPO (Q6, Q25) |
| Which research questions and projects | ALU and Pedagogisk akademi, through HVL's research routine |
| Whether to build it, and when | The owner, with a decision and a requirement |
| Where packages are stored and how they reach researchers (never by e-mail) | HVL IT |
| Each export order | The DPO's approval, run by HVL operations |

## 10. Alternatives considered

- **Researchers query the database:** refused by `DATA-010`; the analytics role reads *k*-suppressed views only.
- **Synthetic data only:** enough to write notebooks (§8), but cannot answer a question about real learning.
- **Differential privacy (added noise) for tiers A and B:** stronger in theory against differencing between packages,
  but it would make research numbers differ from what teachers saw and needs expertise to set up. Worth reconsidering
  if the DPO finds *k*-suppression alone insufficient for repeated exports.
- **Exporting the purge's snapshots only:** already possible through `hvli_analytics`; it answers tier A questions for
  ended years but not item-level ones, and it carries real activity and course IDs (§2).
