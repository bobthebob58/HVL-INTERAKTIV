# Spec 05 — Teacher Insight (Learning Analytics) and Data Protection

| | |
|---|---|
| **Status** | Approved for build (v1.0, 2026-10-16) |
| **Load in sessions** | S1: §2 (`DATA-001`, `DATA-002`, `DATA-009`), §4, §5 · S4: `DATA-006`, `DATA-011` · S6: all |
| **Owns requirement IDs** | `INS-*`, `DATA-*` |
| **Code location** | `apps/server/src/insight/`, `apps/server/src/privacy/`, `apps/server/src/web/`, `apps/server/src/http/h5pPageCsp.ts`, `apps/web/src/app/innsikt/` |

Insight exists for one purpose: to help a teacher decide what to do in the next synchronous
session (Just-in-Time Teaching). It is **not** for surveilling or ranking individual students.
Every design choice below follows from that purpose.

---

## 1. Teacher insight ("Innsikt")

The default view is **Før samlinga** ("before the session"): results since a chosen date (default
7 days ago), for one activity, in one Canvas context (or all portal users for that activity).

#### INS-001 · MUST · S6 · Participation overview
Shows: learners who **started**, learners who **completed**, completion rate (denominator from NRPS
when available, `LTI-008`, otherwise "of those who started"), median time on task, and median
number of attempts.
- **Acceptance:** Numbers match a hand-calculated fixture of 30 synthetic learners.
- **Verify:** Unit tests of the aggregation queries.

#### INS-002 · MUST · S6 · Item difficulty
For each question (sub-content) the view shows: % correct on the first attempt, % correct on the
latest attempt, and the number of learners. Items are sorted from hardest first. The question text
is shown next to each item so the teacher does not need to open the editor.
- **Verify:** Unit tests.

#### INS-003 · MUST · S6 · Misconceptions
For choice questions, it shows how answers are distributed across options, with the **teacher's own
feedback text** for each wrong option next to it. For Blanks and DragText, it shows the most frequent
wrong answers per gap, normalised (trimmed, case-folded) and limited to the top 5. A free-text answer
is displayed only if at least *k* distinct learners gave it (`INS-006`), so a rare and identifiable
answer is never shown. A **"Ta opp i samlinga"** ("bring to seminar") button adds the item to a
shortlist that can be printed or projected.
- **Verify:** Unit tests, including the *k* rule for free text.

#### INS-004 · SHOULD · S6 · Branching paths
For BranchingScenario, the view shows the distribution of choices at each decision node and how
many learners used a retry path.
- **Verify:** Unit tests.

#### INS-005 · COULD · S6 · Video engagement
For InteractiveVideo, it shows the share of learners who answered each embedded interaction. This
serves as a proxy for how far they watched. The spike in Session 6 decides whether H5P's
`progressed` statements are reliable enough for a drop-off curve.

#### INS-006 · MUST · S6 · Minimum group size and no individual view
Any cell, bar or list item that represents fewer than **k = 5** distinct learners is shown as
"< 5" and its value is suppressed. *k* is configurable, with a minimum of 3. If suppression of one
cell would let a hidden value be worked out from the totals, the next-smallest cell is suppressed
too. The insight API has **no endpoint** that returns per-learner rows.
- **Acceptance:** Property-based test: for random datasets, no API response contains a group smaller than *k*.
- **Verify:** `fast-check` property test `[INS-006] …`.

#### INS-007 · MUST · S6 · Who can see insight
Owners and co-authors of an activity can see its insight. In LTI mode, authors of the launch context
see results for *that context only*. Admins can see it only through an audited support action. Each
view writes an audit event (`DATA-007`).
- **Verify:** Permission tests.

#### INS-008 · MUST · S6 · Accessible charts
Each chart has a visible data table alternative and a text summary (e.g. "Question 2: 38 % correct
on first attempt; most common wrong answer: B"). Charts use patterns or labels as well as colour
(`UD-003`) and meet non-text contrast requirements.
- **Verify:** axe; component tests.

#### INS-009 · SHOULD · S6 · Export aggregated CSV
Insight can be exported as CSV, with the same suppression (`INS-006`) applied.
- **Verify:** Unit test.

#### INS-010 · SHOULD · S6 · Validator status in insight
Insight shows the activity's current validator findings and acknowledgements (`UD-022`), so
accessibility debt stays visible.

---

## 2. Data protection requirements

HVL is the data controller. Processing of learner data for teaching rests on GDPR Art. 6(1)(e)
(task in the public interest: higher education). HVL's data protection officer must confirm this
during the DPIA (`DATA-005`).

#### DATA-001 · MUST · S1 · Data inventory
`docs/privacy/DATA-INVENTORY.md` lists every stored field: purpose, category, legal basis,
retention period and location. It must match the Prisma schema (`apps/server/prisma/schema/`). A CI script fails if a Prisma model
or field is missing from the inventory.
- **Verify:** `npm run privacy:inventory-check`.

#### DATA-002 · MUST · S1 · Pseudonymous learners
`learnerKey = HMAC-SHA256(PSEUDONYM_SECRET[academicYear], source)`, where `source` is
`feide|<feide-id>` or `lti|<iss>|<sub>`. The secret is held in the secret store, rotated per academic
year, and destroyed when that year's data is purged. Learner rows store **no** names, e-mail
addresses, Feide IDs, national ID numbers or raw LTI `sub` values. The one exception is the encrypted
`ltiSub` in `GradeSyncJob`, which AGS needs; it is deleted 30 days after a successful sync.
- **Verify:** Unit tests for key derivation; schema test asserting no PII columns on learner tables.

#### DATA-003 · MUST · S6 · Annual retention purge
A scheduled job runs on a configured date (default 15 August), for the academic year that has
ended. It deletes `XapiStatement`, `H5PUserData`, `GradeSyncJob` and learner `Identity` rows older
than the academic-year boundary plus 30 days, then learner `User` rows that have no `Identity` left
(D-034), and destroys that year's pseudonym secret. Only
aggregate snapshots that already satisfy *k*-suppression are kept, for the *pedagogisk mappe*.
- **Acceptance:** A dry-run mode reports counts without deleting. Each run writes an audit event with the counts.
- **Verify:** Integration test with time travel.

#### DATA-004 · MUST · S6 · EEA residency and encryption
PostgreSQL, Redis and S3-compatible storage are hosted in Norway or the EEA. All traffic uses TLS
1.2 or later. Storage is encrypted at rest. Backups are encrypted and retained for 30 days.
- **Verify:** Deployment checklist (`docs/ops/`).

#### DATA-005 · MUST · S6 · DPIA input
`docs/privacy/DPIA-INPUT.md` describes processing operations, data flows (with a diagram), risks
and mitigations. It cross-references this spec, so HVL's data protection officer can complete the
formal DPIA. It records the Canvas developer key's `privacy_level` (`anonymous`) **and** its custom
fields: in LTI 1.3, custom-field substitutions such as `$Canvas.user.loginId` release data whatever the
privacy level, so adding one requires a DPIA update.
- **Verify:** Evaluator review.

#### DATA-006 · MUST · S4 · Transparency for students
The player footer links to a short privacy notice in `nn`, `nb` and `en`. It says what is stored,
why, for how long, and who can see what. In particular, teachers see only groups of at least *k* learners.
- **Verify:** Component test; content review.

#### DATA-007 · MUST · S6 · Audit log
`AuditEvent(at, actorUserId, action, targetType, targetId, details jsonb)` records: insight views,
exports, library installs and updates, permission changes, data-subject actions and purge runs. The
audit log itself has no free-text personal data. It is kept for 2 years.
- **Verify:** Integration tests assert events for each action.

#### DATA-008 · MUST · S6 · Data-subject requests
An admin-only tool takes a Feide ID or an `(iss, sub)` pair. It derives the learner keys for the
retained academic years, then exports (JSON) or deletes that learner's data. Every use is audited.
- **Verify:** Integration test of export and erasure.

#### DATA-009 · MUST · S1 · Logs contain no personal data
The logger (pino) redacts `authorization`, `cookie`, `ltik`, `id_token`, `email`, `name`, `sub`,
`feide*`, and any key named `response` (answer content). Application logs are kept for 30 days.
- **Verify:** Unit test of redaction paths (`NFR-006`).

#### DATA-010 · MUST · S6 · Least-privilege access to infrastructure
Separate database roles are used for the app, for migrations and for read-only analytics. Production
data is never copied to development; test data is synthetic.
- **Verify:** Ops checklist; migration role used only in CI/CD.

#### DATA-011 · MUST · S4 · No third-party tracking or CDNs
Student-facing pages load no third-party scripts, fonts, analytics or embeds other than ones the
author has explicitly added (e.g. a Panopto video). Fonts are self-hosted. A
`Content-Security-Policy` enforces this.
- **Verify:** Playwright test records all network requests on a seed activity and asserts first-party only.

#### DATA-012 · MUST · S6 · Minimal xAPI storage
For each statement, store only: `contentId`, `subContentId?`, `contentVersion`, `contextId?`,
`learnerKey`, `verb`, `scoreRaw?`, `scoreMax?`, `scaled?`, `success?`, `completion?`,
`response?` (choice indices or short gap text), `durationMs?`, `attemptId`, `timestamp`. Everything
else is dropped, including actor names, mailboxes and extensions.
- **Verify:** Unit test of the mapper.

---

## 3. What teachers can and cannot see (summary for privacy notices and evaluators)

| Teachers **can** see | Teachers **cannot** see |
|---|---|
| How many learners started or completed (groups ≥ k) | Which named student did what (individual grades are only in Canvas, through AGS) |
| % correct per question, distribution of answers (groups ≥ k) | Rare free-text answers given by fewer than *k* learners |
| Their own feedback texts next to the results | Data from other courses' contexts |
| Grade-sync status counts | Raw xAPI statements |

---

## 4. Consolidated logical data model

Session 1 turns this into the Prisma schema in `apps/server/prisma/schema/*.prisma`. **PII** marks fields that are
personal data; **P** marks pseudonymous fields.

| Entity | Owner spec | Notable fields |
|---|---|---|
| `User`, `Identity` | 02 | `displayName`/`email` for staff only (**PII**; from S5 the name is shown to HVL colleagues in co-author search, bank listings and copy attribution, D-090–D-092); `coAuthorSearchableAt` (staff, D-090); `subjectHash` (**P**) |
| `H5PContent`, `H5PContentFile`, `ContentCollaborator`, `LibraryAuditEvent` | 01 | `ownerUserId`; `sourceAuthorUserId` on copies (S5, D-092) |
| `H5PUserData` | 01 | `learnerKey` (**P**), `data` (**P**) |
| `LtiPlatform`, `LtiIdToken`, `LtiNonce`, `LtiAccessToken`, `LtiPlacement` | 02 | ID tokens (**PII**, 24 h) |
| `GradeSyncJob` | 02 | `ltiSub` (**PII**, encrypted, 30 days after success) |
| `LearningDesignMetadata`, `LearningOutcome` | 04 | none |
| `ValidationAcknowledgement` | 03 | `userId` (author) |
| `XapiStatement` | 05 | `learnerKey` (**P**), `response` (**P**) |
| `InsightSnapshot` | 05 | aggregates only, already *k*-suppressed |
| `AuditEvent` | 05 | `actorUserId` |

## 5. Pseudonymisation sequence (for evaluators)

```
Feide login / LTI launch
   │  raw id (feide id or iss+sub) — exists only in memory during the request
   ▼
learnerKey = HMAC_SHA256(secret[yyyy], "lti|" + iss + "|" + sub)
   │
   ├─► H5PUserData.learnerKey     (resume state)
   ├─► XapiStatement.learnerKey   (insight aggregates, k ≥ 5)
   └─► GradeSyncJob.ltiSub (encrypted) only while a Canvas grade is pending
At the yearly purge: rows deleted, secret[yyyy] destroyed → any remaining aggregate can no longer be linked to anyone.
```
