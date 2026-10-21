# Spec 00 — Product, Users and Pedagogical Intent

| | |
|---|---|
| **Status** | Approved for build (v1.0, 2026-10-16) |
| **Load in sessions** | All sessions read §1–§4. Feature details (§5) are loaded when a session implements them. |
| **Owns requirement IDs** | `PROD-*`, `NFR-*` |
| **Related** | [01 H5P core](01-h5p-core128.md) · [02 Auth/LTI](02-auth-feide-lti13.md) · [03 Universal design](03-hvl-wcag-theme.md) · [04 Læringsdesign](04-laeringsdesign-page.md) · [05 Analytics & privacy](05-analytics-privacy.md) · [Glossary](../GLOSSARY.md) |

How to read the requirements: each one has an ID, a priority (**MUST**, **SHOULD** or **COULD**, with the
RFC 2119 meanings), the session that delivers it (`S1`–`S6`), a statement, *acceptance criteria*
that can be tested, and a *verification* method. Code and tests refer back to these IDs
(see [DOCUMENTATION-STANDARD](../DOCUMENTATION-STANDARD.md)), so an evaluator can follow any ID from
spec to code to test.

---

## 1. Problem and product promise

### 1.1 The problem we are solving

Asynchronous study at HVL often means students watch a 45-minute lecture recording or read a PDF that
was uploaded to Canvas. This is passive. Research on multimedia learning and retrieval practice
(see §4) shows that students learn more from short segments with frequent low-stakes questions. They
also learn more when feedback explains *why* an answer is wrong, not just *that* it is wrong.
Teachers face three practical barriers:

1. **Authoring friction.** Interactive tools such as H5P have dozens of content types and many
   settings. Most of the settings do not help pedagogically, and several content types are not
   accessible. Teachers have little time and no guidance on which design actually works.
2. **No feedback loop.** After setting asynchronous pre-work (*forarbeid*), a teacher cannot see
   what students struggled with before meeting them. The synchronous session therefore cannot
   respond to it.
3. **Institutional obligations.** Universal design (WCAG / *forskrift om universell utforming av
   IKT*), GDPR, Canvas integration and documentation for the *pedagogisk mappe* are each solved
   separately, by hand, if at all.

### 1.2 Product promise

> **HVL Interaktiv lets a teacher take one learning outcome and turn it into a short, accessible,
> interactive activity in under 30 minutes. The teacher can place it in Canvas, and walk into the
> next seminar knowing which misconceptions to address.**

Everything in this specification serves that sentence. If a proposed feature does not shorten
the path to a *good* activity, make it more accessible, or close the feedback loop between
asynchronous and synchronous teaching, it is out of scope.

---

## 2. Users and personas

Personas are composites. They exist to make requirements concrete; they are not real people.

| Persona | Role | Context | What success looks like |
|---|---|---|---|
| **Ingrid** | Associate professor, nursing (Bergen) | Prepares students for clinical placement (*praksis*); 90 students; uses Canvas and Panopto daily; little time for tooling. | Creates a three-decision clinical case in a branching scenario. Students practise judgement before placement. In the seminar, Ingrid discusses the choice most students got wrong. |
| **Lars** | Lecturer, engineering (Haugesund) | Runs a flipped first-year course with 200 students; records short videos. | Students answer embedded questions in an 8-minute video. On Wednesday evening Lars sees that 62 % chose the same wrong option on question 2, and opens Thursday's lecture with it. |
| **Amina** | Part-time student, social education | Works days; studies on a phone in the evening; often interrupted. | Can stop halfway through a module and resume at the same place the next evening. Gets feedback that explains the misconception. |
| **Jonas** | Student, teacher education (PPU) | Blind; uses a screen reader (NVDA on Windows, VoiceOver on iPhone). | Completes every activity with keyboard and screen reader alone. Feedback is announced with text, not only colour. |
| **Kari** | Learning designer, ALU (*Avdeling for utvikling av læring og undervisning*) | Supports teachers across faculties; curates templates. | Can point teachers to the studio's patterns and planner instead of repeating the same advice in one-to-one meetings. |
| **Ola** | Platform administrator, TeCopp | Approves LTI tools for Canvas; responsible for library updates and incident response. | Only vetted H5P libraries run. Updates are controlled. Logs contain no personal data, and the accessibility statement is easy to keep current. |

Roles in the system (used throughout the specs):

| Role | Who | Can |
|---|---|---|
| `learner` | Students (Feide affiliation `student`, or LTI role `Learner`) | Play published activities; resume their own state. |
| `author` | Staff and faculty (Feide `employee`/`faculty`/`staff`), LTI `Instructor`/`TeachingAssistant`/`ContentDeveloper`, plus allow-listed student-author courses (e.g. PPU) | Create, edit, share and publish activities; view aggregated insight for activities they own or co-own; export *pedagogisk mappe*. |
| `admin` | Named platform administrators (allow-list in config, Feide login only) | Everything an author can do, plus: install and update H5P libraries, manage platforms, run data-subject requests, view audit log. **Never granted through an LTI launch.** |

---

## 3. Core user journeys

These journeys are the end-to-end acceptance tests of the product (Playwright, Session 6).
Each step names the requirements it exercises.

**J1 — Create from a pattern and place it in Canvas (Lars).**
1. In a Canvas module, Lars chooses *Add item → External tool → HVL Interaktiv* (Deep Linking, `LTI-005`).
2. The picker shows Lars's activities and *Create new*. Lars chooses the phase **Forarbeid** and the
   pattern *Short video with retrieval checks* (`PROD-001`, `PED-010`).
3. The H5P editor opens with an Interactive Video skeleton. It contains three question placeholders
   at 2–3 minute spacing, a summary task at the end, and guidance text in Nynorsk (`H5P-002`, `H5P-008`).
4. Lars pastes a Panopto link, writes the questions and adds feedback for each wrong option.
5. Lars clicks **Check and publish**. The quality check reports one error, a missing caption track, and
   one hint, that question 3 has no feedback for option C (`PROD-003`, `UD-020`, `PED-020`). Lars fixes both.
6. The activity is published and returned to Canvas as a graded resource link (`LTI-005`, `LTI-012`).

**J2 — Study asynchronously on a phone and resume (Amina, Jonas).**
1. Amina opens the activity from Canvas on a phone. It loads in under 3 s (`NFR-001`) and reflows
   to 320 px width (`UD-008`).
2. Amina answers two questions. Wrong answers show **✗ Feil:** and an explanation (`UD-003`).
3. Amina closes the app and, the next evening, resumes at the same point (`PROD-008`, `H5P-005`).
4. Jonas completes the same activity with NVDA and the keyboard only (`UD-006`, verified manually per `UD-031`).

**J3 — Prepare the seminar from evidence (Lars, Ingrid).**
1. Wednesday evening Lars opens **Innsikt → Før samlinga** for the activity (`INS-001`).
2. Lars sees that 148 students started and 131 completed. Question 2 had 38 % correct on the first attempt,
   and 62 % chose option B (`INS-002`, `INS-003`). Cells with fewer than five students are hidden (`INS-006`).
3. Lars adds question 2 to the *Bring to seminar* shortlist and opens Thursday's session with it.

**J4 — Document practice for the teaching portfolio (Ingrid).**
1. Ingrid tags each activity with phase, learning outcomes and a short didactic rationale (`PED-030`).
2. Ingrid chooses **Pedagogisk mappe → Export** and receives a Markdown file and an accessible PDF.
   They contain the designs, each design's universal design status and anonymised aggregate results (`MAPPE-001`…`MAPPE-004`).

**J5 — Govern the platform (Kari, Ola).**
1. Kari edits pattern guidance text in the studio's content files and opens a pull request; no code changes are needed (`PED-011`).
2. Ola installs a new library version in staging, verifies it, then promotes it. Non-admins cannot
   install or update libraries, even through an uploaded `.h5p` file (`H5P-006`, `SEC-003`).

---

## 4. Design principles and the pedagogy behind them

| # | Principle | What it means in the product | Evidence base (verify citations with ALU before publishing on the studio page) |
|---|---|---|---|
| P1 | **Pedagogy before features** | Users start from a learning-design *pattern*, not from an empty list of content types. | Biggs (1996), constructive alignment, *Higher Education* 32 |
| P2 | **Short segments, frequent retrieval** | Video patterns default to 6–9 min with checks every 2–3 min. | Guo, Kim & Rubin (2014), *L@S '14*; Szpunar, Khan & Schacter (2013), *PNAS* 110(16); Roediger & Karpicke (2006), *Psychological Science* 17(3) |
| P3 | **Feedback that explains** | Wrong-option feedback is prompted, checked and highlighted in insight. | Shute (2008), *Review of Educational Research* 78(1); Hattie & Timperley (2007), *RER* 77(1); Nicol & Macfarlane-Dick (2006), *Studies in Higher Education* 31(2) |
| P4 | **Formative by default** | Retry and *Show solution* are on; no timers; scores are low-stakes. | Dunlosky et al. (2013), *Psychological Science in the Public Interest* 14(1) |
| P5 | **Close the async → sync loop** | Insight is designed for the evening before a seminar. | Novak, Patterson, Gavrin & Christian (1999), *Just-in-Time Teaching* |
| P6 | **Practise professional judgement safely** | Branching scenarios with 3–4 decision points, explanations and retry paths. | Schön (1983), *The Reflective Practitioner*; van Manen (1991), *The Tact of Teaching* |
| P7 | **Accessible by default, not by audit** | Theme, validator and patterns prevent barriers before publishing. | WCAG 2.2; Norwegian *forskrift om universell utforming av IKT-løysingar* |
| P8 | **Privacy by design** | Pseudonymous learners, aggregated insight only, yearly purge. | GDPR Art. 5 and 25 |
| P9 | **Nynorsk first** | UI and H5P strings default to `nn`, with `nb` and `en` as fallbacks. | HVL language policy; *mållova* |
| P10 | **Less is more** | Exactly ten content types; sensible defaults; settings hidden unless they help learning. | Sweller (1988), cognitive load, *Cognitive Science* 12(2) |

---

## 5. Functional requirements

#### PROD-001 · MUST · S5 · Create an activity from a learning-design pattern
An author can create a new activity by choosing a phase (*Forarbeid*, *Mellomarbeid*, *Etterarbeid*)
and then a pattern. The H5P editor opens pre-filled with a pedagogically sound skeleton and guidance.
- **Acceptance:** Every pattern in [04 §4](04-laeringsdesign-page.md#4-pattern-catalogue) can be
  instantiated. The created content passes `validateContent` with zero *errors* before the author
  edits it, apart from placeholders that are deliberately flagged as needing input. Choosing *blank
  activity* is still possible.
- **Verify:** Integration test that creates each pattern; e2e for J1.

#### PROD-002 · MUST · S2 · Exactly ten authorable content types
Authors can create only the ten content types in [01 §3](01-h5p-core128.md#3-the-ten-content-types).
- **Acceptance:** See `H5P-002`.
- **Verify:** Covered by `H5P-002` tests.

#### PROD-003 · MUST · S4 · Check-and-publish quality gate
Activities have the states `draft` and `published`. *Publish* runs the universal design validator
(`UD-020`) and the pedagogical hints (`PED-020`). Findings are listed in plain language with a
*Go to field* link.
- **Acceptance:** An *error* blocks publishing unless the author records an acknowledgement with a
  reason (e.g. "captions are being produced in Panopto"). Acknowledgements are stored, appear in
  insight and in the portfolio export, and are raised again on the next publish after 14 days.
  *Warnings* and *hints* never block.
- **Verify:** Unit tests for state transitions; e2e for J1 step 5.

#### PROD-004 · MUST · S3 · Learners only see published activities
- **Acceptance:** A learner request for a `draft` returns a friendly "not yet available" page
  (HTTP 404 to avoid revealing its existence). Authors can preview drafts.
- **Verify:** Integration test.

#### PROD-005 · MUST · S3 · Place activities in Canvas
Authors can place an activity in a Canvas module, assignment or rich-content editor through LTI Deep Linking. See `LTI-005`.

#### PROD-006 · MUST · S3 · Share outside Canvas with Feide
An author can share an activity link that works outside Canvas. Viewers log in with Feide.
Visibility is one of: *only me / co-authors*, *everyone at HVL*, or *anyone with a Feide login*.
- **Acceptance:** Visibility is enforced by the permission system (`H5P-006`). Changing visibility
  takes effect immediately.
- **Verify:** Integration tests per visibility level.

#### PROD-007 · SHOULD · S5 · Co-authoring and an institutional content bank
Authors can add co-authors (HVL staff found by name or Feide ID) and can publish an activity to the
HVL content bank so that colleagues can *duplicate and adapt* it.
- **Acceptance:** A duplicate keeps a link to its source and the original author's attribution. It
  never copies learner data.
- **Verify:** Integration tests.

#### PROD-008 · MUST · S2 · Resume where you left off
A learner who leaves an activity and returns on any device resumes with their previous answers and position. See `H5P-005`.

#### PROD-009 · MUST · S5 · Formative defaults
For all patterns, *Retry* and *Show solution* are enabled, there are no time limits, and pass
thresholds are informative rather than gatekeeping.
- **Acceptance:** Pattern skeletons set the relevant behaviour fields. The hint rule `PED-H07`
  flags activities where an author has turned these off.
- **Verify:** Unit tests on skeleton parameters.

#### PROD-010 · MUST · S6 · Teacher insight before the seminar
Authors see aggregated, anonymised results per activity, designed to prepare the next synchronous session. See `INS-*` in [05](05-analytics-privacy.md).

#### PROD-011 · MUST · S4 · Formative-use notice
The editor and the Deep Linking picker show a short, dismissible notice. It says H5P activities are
scored in the browser and are meant for formative work (*undervegsvurdering*), not exams.
- **Acceptance:** Notice text exists in `nn`, `nb` and `en`. Dismissal is remembered per user.
- **Verify:** Component test.

#### PROD-012 · MUST · S1 · Three languages, Nynorsk first
All UI is available in Nynorsk (default), Bokmål and English. H5P strings fall back from `nn` to `nb` to `en`. See `H5P-008`.
- **Acceptance:** A test fails if any key is missing in a locale file.
- **Verify:** Unit test for key parity.

#### PROD-013 · SHOULD · S5 · Safe editing of a published activity
When an author edits an activity that already has learner state, the editor warns that structural
changes (adding, removing or reordering questions) reset saved progress. It offers *Save as new version*.
- **Acceptance:** Existing learner state is invalidated only when the author confirms. Insight
  separates results by version.
- **Verify:** Integration test.

#### PROD-014 · COULD · S6 · Spaced-retrieval suggestion
After publishing an *Etterarbeid* activity, the author is shown suggested repetition dates (for
example +7 and +21 days) and a one-click copy to place in a later Canvas module.
- **Verify:** Component test.

---

## 6. Non-functional requirements

#### NFR-001 · MUST · S6 · Performance
An activity page (player plus content) becomes interactive in ≤ 3 s at p95 on a simulated "Fast 4G"
profile with 200 concurrent learners on one application node. API p95 is ≤ 300 ms excluding file downloads.
- **Verify:** k6 or Artillery load test script in `tools/load/`; Lighthouse CI on the player route.

#### NFR-002 · MUST · S6 · Availability and recoverability
99.5 % monthly availability during the semester. Database backups run daily with 30-day retention.
A documented restore is tested once per semester.
- **Verify:** Operations runbook in `docs/ops/`; restore drill log.

#### NFR-003 · MUST · S4 · Mobile and assistive technology
Works on the last two versions of Chrome, Edge, Firefox and Safari, on iOS Safari and on Android
Chrome, and with NVDA, JAWS and VoiceOver. See [03](03-hvl-wcag-theme.md).

#### NFR-004 · MUST · S1 · Maintainability
Source files are ≤ 200 lines and each has a single responsibility. Every file follows
[DOCUMENTATION-STANDARD](../DOCUMENTATION-STANDARD.md). CI runs typecheck, lint, tests and the
traceability check.
- **Verify:** `npm run check:filesize`, `npm run spec:trace` in CI.

#### NFR-005 · MUST · S1 · Open source licence
The repository is licensed **GPL-3.0-or-later**. This is required because `@lumieducation/h5p-server`
is GPL-3.0-or-later. Dependencies must be GPL-3.0-compatible (for example MIT, BSD, Apache-2.0, ISC).
- **Verify:** A licence check in CI against a GPL-3.0-compatible allow-list (`npm run check:licences`, D-029).

#### NFR-006 · MUST · S6 · Observability without personal data
Logs are structured JSON with request ID, route, status and latency. They must never contain names,
e-mail addresses, Feide IDs, LTI `sub` values, ltik tokens, or answer contents. See `DATA-009`.
- **Verify:** A unit test runs the log redaction function against a fixture of sensitive fields.

#### NFR-007 · MUST · S6 · Deployable on HVL or Sikt infrastructure
Docker images and `docker-compose.yml` for local and staging environments. Only EEA-hosted
PostgreSQL, Redis and S3-compatible storage. No runtime calls to third-party CDNs (see `DATA-011`).
- **Verify:** `docker compose up` smoke test in CI.

---

## 7. Scope boundaries

**In scope (v1):** the ten H5P content types; Feide portal; Canvas LTI 1.3 (launch, Deep Linking,
AGS, optionally NRPS); universal design theme and validator; læringsdesign studio; pedagogisk mappe
export; teacher insight; GDPR controls; Docker deployment.

**Out of scope (v1), with the reason:**

| Not in v1 | Why |
|---|---|
| Summative exams or proctoring | H5P scores in the browser and can be manipulated; HVL uses Wiseflow for exams. |
| Generative-AI authoring | Needs its own DPIA, quality and academic-integrity review. Revisit after the pilot. |
| Individual learner dashboards for teachers | Canvas already shows individual grades. Aggregates are enough for teaching decisions and are better for privacy. |
| Content types beyond the ten | Kept small on purpose (P10). Adding one is a decision log entry plus accessibility review. |
| Native mobile apps | The responsive web player is sufficient. |
| LMSs other than Canvas | Canvas is mandatory at HVL. LTI 1.3 keeps other LMSs possible later. |

---

## 8. Success measures for the pilot (Session 5 onwards, with Pedagogisk akademi and ALU)

| Measure | Target | How measured |
|---|---|---|
| Median time from *Create* to *Published* for a first activity | ≤ 30 min | Timestamps in the audit log (no content) |
| Published activities with zero validator errors and no acknowledgements | ≥ 90 % | Validator results |
| Activities whose wrong options all have feedback | ≥ 75 % | `PED-H05` results |
| Teacher-rated usability (SUS) | ≥ 75 | Survey of pilot teachers |
| Pilot teachers who opened *Før samlinga* before at least half of their seminars | ≥ 50 % | Audit log |
| Critical axe-core violations on any route or content type | 0 | CI |
