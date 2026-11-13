# DPIA input

| | |
|---|---|
| **Requirement** | `DATA-005` (spec 05 §2), with the other data-protection requirements `DATA-001`…`DATA-012` it cross-references (§11) |
| **For** | HVL's data protection officer (DPO, *personvernombod*), who completes the formal data protection impact assessment (GDPR Art. 35) from this input (open question Q6) |
| **Controller** | Høgskulen på Vestlandet (HVL) |
| **Status** | Complete for the S6 build, 2026-11-05. Nothing here has run against HVL's real Canvas, Feide or servers yet; values marked *(verify)* need HVL's facts. This is engineering input, not a legal conclusion: every "legal basis", "accept" or "option" below is for the DPO to decide. |
| **Sources** | [DATA-INVENTORY.md](DATA-INVENTORY.md) (every stored field, its purpose, category, retention and location), [spec 05](../specs/05-analytics-privacy.md) §1–§5, spec 02 (login and Canvas), [`docs/DECISIONS.md`](../DECISIONS.md), the runbooks in [`docs/ops/`](../ops/README.md), [`docs/reference/canvas-lti13-developer-key.json`](../reference/canvas-lti13-developer-key.json) and [`canvas-platform-values.md`](../reference/canvas-platform-values.md) |
| **Keep it true** | Update this file, and the inventory, **before** any of these changes: the Canvas developer key's `privacy_level`, scopes, placements or custom fields (§6); a new stored field; a new recipient or host the server or the learner's browser talks to; a new purpose (for example research, [research-export.md](research-export.md)) |

## 1. The service in brief

HVL Interaktiv lets HVL staff make interactive H5P learning activities and lets students play them, in a web portal
(Feide login) and inside Canvas (LTI 1.3). It keeps learning data for formative use only: so a student can resume an
activity, so a teacher can see in aggregate what a group finds hard before the next seminar (Just-in-Time Teaching,
the **Innsikt** tab), and so a graded Canvas assignment gets a formative score. It is **not** for surveilling or
ranking students, and its scores are never exam evidence (spec 05's introduction; CLAUDE.md §1).

| Who | How they meet the service |
|---|---|
| Learners | HVL students, and anyone a Canvas course enrols (for example exchange students, or HVL employees enrolled as students in ALU's university-pedagogy courses, R40), playing activities in the portal or in Canvas. In the portal also anyone with a Feide login from another organisation, on activities shared with «anyone with Feide» (spec 02's role table, D-059); Feide also serves schools, so that can include pupils (R37) |
| Authors | HVL staff with the author role (`AUTH-002`), student authors in configured FS course groups (`AUTHOR_COURSE_GROUPS`, D-059), and anyone Canvas launches as a teacher, designer or TA (`LTI-004`), which can be a student assistant (R36) |
| Admins | Named HVL staff (`ADMIN_FEIDE_IDS`, Feide login only; never through Canvas). They install H5P libraries. They see no insight (D-106) |
| HVL operations | Run the servers, the yearly purge's checks, data-subject requests (a CLI, D-108) and the database roles (D-109) |
| Canvas's test student | Canvas's «Student View» launches a fake learner for a teacher's own test (D-102's amendment of 2026-11-04) |

Scale for the pilot: *(verify, HVL: courses and students in the pilot)*.

## 2. Purposes and legal basis

HVL is the controller. The working assumption (spec 05 §2) is GDPR **Art. 6(1)(e)**, a task carried out in the public
interest: higher education. The DPO is asked to confirm it, and to name the supplementary basis in Norwegian law that
Art. 6(3) requires *(DPO: for example the Universities and University Colleges Act; verify)*, also for staff data,
where another basis may fit better (Q6). No consent is asked: a student who must use an activity in a course cannot
give consent freely, and the processing serves teaching. Art. 6(1)(e) gives learners the right to object (Art. 21,
§9 and R34).

| # | Purpose | Whose data | What is stored | Requirements |
|---|---|---|---|---|
| P1 | Resume an activity where the learner left it | Learners | `H5PUserData` under the learner's pseudonym | `H5P-005` |
| P2 | Show teachers, in aggregate, how a group did, before the next seminar | Learners | `XapiStatement` (`DATA-012`'s fields), read only as *k*-suppressed aggregates | `INS-001`…`INS-010`, `DATA-012` |
| P3 | Send a formative score to a graded Canvas assignment | Learners in graded placements | Root results in `XapiStatement`; one `GradeSyncJob` per learner and placement, with the Canvas user ID encrypted | `LTI-010`…`LTI-013` |
| P4 | Give the completion rate a base: how many learners a course has | Canvas course members | Only the count, read from Canvas's roster in memory | `LTI-008` |
| P5 | Log in, keep a session, decide permissions | Everyone | `User`, `Identity` (a keyed hash), the session in Redis | `AUTH-*`, `LTI-*` |
| P6 | Author, co-author, share and copy activities | Staff | Display name, ownership, authored content | `PROD-*` |
| P7 | The *pedagogisk mappe* (a teacher's portfolio) | Staff; learners only as *k*-suppressed aggregates | Nothing new: it reads the `XapiStatement` rows under the mappe's group rules (D-095), and the teacher's texts are rendered, not stored; the purge's snapshots are kept for it but not read yet (D-107) | `MAPPE-*`, `DATA-003` |
| P8 | Security and accountability | Everyone | `AuditEvent`, `AuthAuditEvent`, `LibraryAuditEvent` | `DATA-007` |
| P9 | Run the service: yearly purge, data-subject requests, logs without personal data | Everyone | Audit events with counts only | `DATA-003`, `DATA-008`, `DATA-009`, `NFR-006` |
| P10 | Evaluate activities and the service in aggregate, with read-only analytics tools (O15) | Learners only as *k*-suppressed aggregates; staff through the activities and courses named | Nothing new: the view `analytics.insight_snapshot` of the purge's snapshots | `DATA-010`, D-109 |

P10 is the purpose the read-only role `hvli_analytics` (D-109) was built for, but who gets it and for which questions
is not named anywhere yet *(owner: name the analysts and the purpose before anyone gets the role)*; research is not
P10 (Q25).

**Not purposes, and not done:** research on students' learning (needs its own basis and the DPO's approval first;
[research-export.md](research-export.md), Q25); monitoring, ranking or profiling individual students; exam evidence
or summative grading; marketing; analytics or advertising by third parties. Pilot measures that read the audit log
are named in R33.

**Special categories (Art. 9):** none by design. Learners' typed answers and authored content can still contain such
data (R30, R31).

## 3. Data subjects and data categories

Every stored field, with its category, is in [DATA-INVENTORY.md](DATA-INVENTORY.md); `npm run privacy:inventory-check`
fails CI when the schema and the inventory disagree, or when a learner table gains a column named like a direct
identifier (`DATA-001`, `DATA-002`).

**Learners** are stored only under pseudonyms (`DATA-002`, D-011): `learnerKey`, an HMAC-SHA256 of `feide|<Feide ID>`
or `lti|<issuer>|<sub>` with that academic year's secret, and `Identity.subjectHash`, an HMAC with a stable identity key
that is rotated by rule (D-055). Under those pseudonyms the service stores: saved progress; learning events reduced
to `DATA-012`'s fields (activity, question, content version, course, verb, scores, success, completion, chosen options
or gap text cut to 100 characters per gap, duration, attempt, time, academic year, whether it was Canvas's test
student); and per graded placement one grade job. A learner row never holds a name, e-mail address, Feide ID,
national identity number or raw Canvas `sub`: the inventory check refuses such a column on a learner table, and a
database `CHECK` keeps a learner's `User` row without a display name or e-mail address.

Raw learner identifiers exist only: in memory during a request; in `LtiIdToken.claims` for 24 hours (the launch's
`sub`, roles, course and link, never names or e-mail, D-052); encrypted in `GradeSyncJob.ltiSubEncrypted` until 30 days
after the job stops (D-104); and in the portal session, where Feide's ID token (name, e-mail, Feide ID) is kept
encrypted for at most 12 hours, only to log the person out of Feide (D-021, D-056).

**Pseudonymous is not anonymous.** HVL can link a year's rows to a person while it holds that year's secret: given
the person's Feide ID or Canvas `sub`, the data-subject CLI does exactly that (D-108). Whoever holds a year's secret, a
copy of the database and a list of candidate identifiers (for example all Feide IDs at HVL) could link every row of
that year. Hence the secrets are kept apart from the database (the server's environment, HVL's secret store), and
each year's secret is destroyed after the yearly purge (D-107, R15).

**Staff:** display name (from Feide; shown to co-authors, in co-author search, the content bank and copy
attribution, D-090–D-092), a keyed hash of their Feide ID, ownership and co-authorship of activities, authored
content and its metadata (which may name authors), reasons given when publishing despite a validator error, notice
dismissals, and audit events about what they did. Staff e-mail is not stored (D-090's amendment). An employee whom a
Canvas course enrols as a student is a learner there, with a learner's data under a learner's pseudonym (O4, R40).

**Others:** people named or shown in authored content, such as cases, photos or videos (R31).

**Never processed:** national identity numbers (Feide's `userid-nin` is never requested), photos of users, IP
addresses in clear (only a keyed hash in `AuthAuditEvent`), user agents, xAPI actors, statement texts or feedback.

## 4. Processing operations

| # | Operation | What happens to personal data | Requirements, decisions |
|---|---|---|---|
| O1 | **Feide login** (portal) | Feide returns an ID token (name, e-mail, Feide ID) and the Groups API returns HVL membership and FS course groups (scope `openid profile email userid-feide groups-org groups-edu`). The server stores a keyed hash of the Feide ID, a staff display name (never a learner's), a Redis session (2 hours idle, 12 hours at most) with the roles computed at login and the ID token encrypted for logout, and an `AuthAuditEvent` with a keyed hash of the IP address. Groups are read in memory only | `AUTH-001`…`AUTH-004`, D-054, D-057, D-064 |
| O2 | **Canvas launch** (LTI 1.3) | Canvas sends a signed ID token with the claims in §6. The server stores an allowlist of claims for 24 hours (D-052), a learner account and a keyed hash of the `sub`, derives the `learnerKey` in memory, and gives the browser an ltik that travels as `Authorization: Bearer` and is kept in memory only. Author launches are audited; learner launches are not (D-064, Q15), but a failed launch is, without an account and with a keyed hash of the IP address | `LTI-001`…`LTI-004`, D-050–D-052 |
| O3 | **Playing and saving progress** | H5P's saved state per learner, activity and course, so the learner can resume | `H5P-005`, D-036, D-093 |
| O4 | **Capturing learning events** | A script in the player page sends learners' H5P statements in batches; the server keeps `DATA-012`'s fields only, under the `learnerKey`, at most 120 statements a minute per learner and activity. A play with the author role is never captured: a portal preview (HVL staff log in to the portal as authors) and a Canvas launch as teacher, designer or TA (D-102). The role comes from the launch alone, so an HVL employee whom a Canvas course enrols as a student is a learner there and is captured, counted and graded like any learner (R40) | `LTI-010`, `LTI-011`, `DATA-012`, D-102, D-115 |
| O5 | **Formative score to Canvas** | For a graded placement, one job per learner; a worker sends the score the placement's attempt policy gives, with the learner's Canvas `sub`, to Canvas (§7). The teacher sees counts of sent, pending, failed and orphaned scores per course (R1) | `LTI-012`, `LTI-013`, D-104, D-105 |
| O6 | **Course count** | After a launch, at most once an hour per course, the server reads the course's roster from Canvas (members' `user_id`, roles and status under `anonymous`) in memory and stores only the number of active learners, for 30 days | `LTI-008`, D-103, D-106 |
| O7 | **Teacher insight** (the **Innsikt** tab and its CSV) | Aggregates for one activity, version and course at a time, over fixed periods that end at the latest midnight in Oslo, suppressed below *k* = 5 learners. Who may see: §7. Each view and CSV download is audited, without counts or answers | `INS-001`…`INS-010`, D-106 |
| O8 | **Authoring and sharing** | Staff create, co-author, publish, list in the content bank and copy activities; co-author search finds HVL staff by name or Feide ID (rate-limited; the query is never logged, audited or stored, D-090), and every co-author change, publication, sharing change, bank listing and copy is audited | `PROD-*`, D-089–D-093 |
| O9 | **The pedagogisk mappe** | A teacher's portfolio export (Markdown or PDF, rendered on the server) with the teacher's own texts and *k*-suppressed results, a rate of 0 % or 100 % hidden too | `MAPPE-*`, D-094–D-096 |
| O10 | **Yearly purge** | On 31 August by default: first *k*-suppressed snapshots of the ended year, then deletion of every learner row whose stored year is before the current academic year (so a year a missed run left goes too), then learner identities and accounts created before 1 August; audited with counts. HVL operations then destroy the year's pseudonym secret | `DATA-003`, D-107, [yearly-purge.md](../ops/yearly-purge.md) |
| O11 | **Data-subject requests** | HVL operations, on the DPO's instruction, export or erase one person's learner data with a CLI that takes the identifiers on standard input; audited with a random request ID and counts | `DATA-008`, D-108, [data-subject-requests.md](../ops/data-subject-requests.md) |
| O12 | **Logs** | One request line per response (request ID, method, route pattern, status, time) and event lines without personal data; kept 30 days by HVL's log store | `DATA-009`, `NFR-006`, D-109 |
| O13 | **Backups** | Daily database backups, encrypted, kept 30 days (HVL's operations) | `NFR-002`, `DATA-004`, D-110 |
| O14 | **Clean-up jobs** | Expired launch records (every 10 minutes), encrypted Canvas IDs 30 days after a job stops (hourly), unsaved editor files | D-052, D-104, `H5P-004` |
| O15 | **Read-only analytics** (P10) | Whoever HVL gives the database role `hvli_analytics` reads the view `analytics.insight_snapshot`: the purge's *k*-suppressed snapshots with the real activity and course IDs and the content type, in read-only sessions, and no table. Nothing yet names who may get the role (§2) | `DATA-010`, D-109 |

## 5. Data flows

```
 Learner's browser                                Teacher's or author's browser
 (portal: session cookie; Canvas: ltik in memory) (the same)
          │ F1 TLS                                         │ F1 TLS
          ▼                                                ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ HVL Interaktiv server (Express and Next.js on one origin)                │
 │ derives learnerKey in memory · keeps DATA-012's fields only              │
 │ k-suppresses insight · queues formative scores · writes audit events     │
 └───┬────────────┬────────────┬────────────┬────────────┬────────────┬─────┘
     │ F6         │ F7         │ F8         │ F2         │ F4, F5     │ F11
     ▼            ▼            ▼            ▼            ▼            ▼
 PostgreSQL     Redis        S3 store     Feide        Canvas       Log store
 rows           sessions,    media        login,       scores out,  30 days,
     │          counters     files        groups       roster in    no personal
     │ F13                                                          data
     ▼
 Encrypted backups, 30 days (HVL)

 Canvas ──────────── F3 ──► browser ──► server: the launch, a signed ID token
 Learner's browser ─ F9 ──► HVL's Panopto and developers.panopto.com (only for an embedded Panopto video)
 HVL operations ─── F12 ──► CLIs on the server host (purge, data-subject requests, database roles)
 Server ─────────── F10 ──► H5P Hub (content-type list, site registration; no personal data)
 Server ─────────── F14 ──► ClamAV, when configured (uploaded files)
```

| # | From → to | What | Protection | Stored |
|---|---|---|---|---|
| F1 | Browser ↔ server | Pages, H5P state, statement batches, insight | TLS; `__Host-` cookies (`HttpOnly`, `Secure`, `SameSite=Lax`) in the portal; in Canvas the ltik as `Authorization: Bearer`, kept in memory, only some H5P paths may carry it in the query (D-058, D-069); CSRF token (D-057); strict CSP (`DATA-011`) | As §3 |
| F2 | Server ↔ Feide (Sikt) | Authorization code with PKCE; ID token (name, e-mail, Feide ID); Groups API (organisation, FS course groups) | TLS; ID-token signature and claims checked (D-054) | Hash of the Feide ID; staff display name; encrypted ID token in the session ≤ 12 h |
| F3 | Canvas → browser → server | The launch: a signed ID token with the claims in §6 | Signature against Canvas's keys, nonce, deployment check (D-050, D-051) | Claims allowlist 24 h; hash of `sub` |
| F4 | Server → Canvas (AGS) | Per learner and graded placement: `userId` (the Canvas `sub`), `scoreGiven`, `scoreMaximum: 100`, progress flags and a timestamp; a read of the assignment's line item to tell a deleted assignment from an error | TLS; client-credentials token signed with the tool's key (D-104); the line-item URL must be https on a Canvas origin HVL configures (D-104's amendment) | Nothing new; the job's state |
| F5 | Canvas → server (NRPS) | The course roster: members' `user_id`, roles and status (no names or e-mail under `anonymous`, canvas-platform-values.md §6) | TLS; the roster URL is checked like F4's (D-106's amendment; see R11) | The count only, 30 days |
| F6 | Server ↔ PostgreSQL | All rows | TLS required in production (`sslmode` `verify-full` recommended); the app role; analysts read *k*-suppressed views only (D-109) | — |
| F7 | Server ↔ Redis | Sessions, login transactions, counters, locks, leases, caches | `rediss://` required in production (D-109) | Keys hashed where they come from a cookie (D-057) |
| F8 | Server ↔ S3 storage | Authored media and temporary editor files | https required; storage must be in an EEA region or on an approved domain (D-109) | Authored content |
| F9 | Learner's browser → Panopto | Only when an author embedded a Panopto video and HVL lists the Panopto origin (`EXTERNAL_MEDIA_ORIGINS`): the video from HVL's Panopto, and Panopto's embed script from `developers.panopto.com` (D-070). Panopto sees the browser's IP address and its own Panopto session | CSP names those origins only; YouTube is never allowed (D-070) | Not by HVL Interaktiv; Panopto's own processing (R35) |
| F10 | Server → H5P Hub (`hub-api.h5p.org`) | Content-type list and site registration (a site UUID) | TLS; usage statistics off (`sendUsageStatistics: false`) | No personal data |
| F11 | Server → log store | JSON lines on standard output | Redaction by key (`DATA-009`); request log names route patterns only | 30 days (HVL) |
| F12 | HVL operations → server host | The purge CLI, the data-subject CLI (identifiers on standard input, export to a file for the DPO), the database-role scripts | Shell access to the server host; runbooks; audit (R20, R21) | Audit events; the export file until handed over |
| F13 | PostgreSQL and the content bucket → backups | Daily `npm run ops:backup` (`tools/ops`): the database dump and the content bucket's objects, with row counts and checksums, no secret | Folders 0700 and files 0600; checksums checked before a restore; the encrypted off-server copy in the EEA is HVL's *(verify, HVL, Q5)*; older backups and stopped runs' partial folders removed (D-110's backup amendment) | 30 days |
| F14 | Server → ClamAV (when `CLAMAV_HOST` is set; required in production) | Uploaded files, streamed to scan for malware before they are stored | HVL's own clamd; TLS unless on the loopback in production (`DATA-004`); fail closed; our log line holds a reason code and filtered signature names only (D-110's ClamAV amendment; R38) | Not stored by ClamAV |

## 6. The Canvas developer key: privacy level and custom fields

As `docs/reference/canvas-lti13-developer-key.json` holds it on 2026-11-05 (to paste into HVL's Canvas, Q4):

| Setting | Value | What it releases to the server |
|---|---|---|
| `privacy_level` | **`anonymous`** (Canvas shows «Private») | In every launch: the Canvas user's `sub` (their `lti_id`), roles, the course (ID, label, title), locale, the platform, custom fields, the AGS and NRPS endpoints and an opaque LTI 1.1 user ID. **Never** name, e-mail or picture (canvas-platform-values.md §6) |
| Scopes | `…/lti-ags/scope/score`, `…/lti-ags/scope/lineitem.readonly`, `…/lti-nrps/scope/contextmembership.readonly` | Sending scores; reading an assignment's metadata (no personal data); reading the course roster, which under `anonymous` holds members' `user_id`, roles and status only. **Not** `result.readonly` (learners' results in Canvas) or line-item write |
| Tool-level `custom_fields` | **none** | — |
| Placement `link_selection` | `feide_login = $Canvas.user.loginId`, `hvl_placement = link_selection` | The Canvas login ID of whoever opens the picker to add a link |
| Placement `assignment_selection` | `feide_login = $Canvas.user.loginId`, `hvl_placement = assignment_selection` | The same, for whoever adds an assignment |
| Placement `editor_button` (visibility `admins`) | `feide_login = $Canvas.user.loginId`, `hvl_placement = editor_button` | The same, for whoever uses the editor button |

**What the server does with them.** `feide_login` reaches the server only in the three Deep Linking placements, which
teachers, designers, TAs and admins open; Canvas merges a placement's custom fields only into that placement's
launches, so a learner's launch never carries it (canvas-platform-values.md §7). The server uses it in memory only,
to link an author's Canvas and Feide accounts when that platform has `"feideLinking": true` (`AUTH-005`, D-063), and
never stores it: the stored claims keep only the custom keys `contentId` and `hvl_placement` (D-052). Whether the
login ID arrives under `anonymous` and equals the Feide ID is unverified (Q4, TeCopp); until then linking stays off.
Student TAs open the picker too, so their login ID reaches the server in memory as well.

**Why this section must be kept current (`DATA-005`).** In LTI 1.3, a custom-field substitution such as
`$Canvas.user.loginId`, `$Person.name.full` or `$Person.email.primary` releases that value **whatever the privacy level**
(canvas-platform-values.md §7). Raising `privacy_level`, adding a custom field (tool-level or on any placement), a
placement or a scope therefore needs an update of this file and the DPO's review **before** the key is changed in
Canvas. The server would drop an unknown custom field from storage (D-052), but it would still receive it.

## 7. Recipients and transfers

| Recipient | What they get | Basis of the relationship |
|---|---|---|
| A course's Canvas authors: teachers, designers and TAs (in Canvas, `/app/play`'s **Innsikt** tab) | *k*-suppressed aggregates for that course; counts of scores sent to Canvas per course (R1) | HVL staff; a TA can be a student assistant (R36); in a staff course the learners are their colleagues (R40) |
| An activity's owner and co-authors (the activity page) | *k*-suppressed aggregates and grade-sync counts for every course the activity is placed in, one course at a time, also a colleague's course (R1, R2) | HVL staff; an owner can be a student author (D-059, R36) |
| Analysts with `hvli_analytics` (O15) | The purge's *k*-suppressed snapshots with activity and course IDs | Not named yet (§2, P10) |
| The teacher's Canvas gradebook | Each learner's formative score in a graded assignment (F4), labelled formative (`LTI-013`, D-105) | HVL's own LMS; Instructure processes Canvas data for HVL under HVL's Canvas agreement *(verify, HVL)* |
| HVL operations | Everything stored, as system administrators; a data-subject export, handed to the DPO | HVL staff, under HVL's routines |
| The hosting provider (Q5: HVL itself or Sikt) | Everything stored, as infrastructure | Processor agreement if not HVL *(HVL IT)* |
| Feide (Sikt) | That a person logs in to this service | HVL's identity provider *(verify roles, HVL)* |
| Panopto | A learner's viewing of an embedded Panopto video (F9) | HVL's video service *(verify agreement and hosting region, HVL)* |
| Nobody else | No analytics, advertising, CDN, font, AI or tracking service is used (`DATA-011`); the H5P Hub gets no personal data (F10) | — |

**Transfers outside the EEA:** none by this service. In production the server refuses file storage outside an EEA
allow-list and unencrypted connections (D-109, R24); where the database and Redis stand is the deployment checklist's
evidence (Q5). Canvas (Instructure) and Panopto are US companies; whether HVL's Canvas and Panopto data, and Panopto's
embed script host `developers.panopto.com`, stay in the EEA is covered by HVL's existing agreements, not by this
service *(verify, HVL)*.

## 8. Retention and deletion

| Data | Kept | Deleted by | Status (2026-11-05) |
|---|---|---|---|
| Learner rows: `XapiStatement`, `H5PUserData`, `GradeSyncJob`, learner `Identity` and `User` | Until the yearly purge, by default 31 August, for the academic year that ended on 31 July | `RetentionPurgeJob` (hourly check, one node) or the purge CLI, by the row's stored `academicYear` (D-107) | Built and tested with travel through a year; the real runs are HVL's |
| The year's pseudonym secret | Until HVL operations remove it after the year's completed purge | Runbook step; the server warns while a purged year's secret is configured | Manual (R15) |
| The encrypted Canvas `sub` (`GradeSyncJob.ltiSubEncrypted`) | 30 days after the job stops, whatever its outcome | `GradeSubjectCleanupJob`, hourly (D-104) | Built |
| Launch records (`LtiIdToken`, `LtiNonce`, `LtiAccessToken`) | 24 hours, 10 minutes, ≤ 1 hour | `LtiRecordCleanupJob`, every 10 minutes (D-052) | Built |
| Portal sessions and login transactions (Redis) | Logout, 2 hours idle or 12 hours; 10 minutes | Redis expiry | Built |
| Rate-limit counters, the course count (Redis) | 60 seconds to 10 minutes; 30 days | Redis expiry | Built |
| `InsightSnapshot` | With the activity (aggregates only) | Deleted with the activity | Built; no end date of its own (R18) |
| Audit records (`AuditEvent`, `AuthAuditEvent`, `LibraryAuditEvent`) | 2 years (`DATA-007`) | Nothing yet; the app's database role may not delete them (D-109) | **Not built** (R27, Q26) |
| Staff accounts, display names, authored content | Until the account or the content is deleted | Content: by its author. Accounts: by hand | No process for people who leave HVL (R28, Q27) |
| Logs | 30 days | HVL's log store | HVL's (`DATA-009`) |
| Backups | 30 days, encrypted | HVL's backup system | `npm run ops:backup -- --keep-days 30` removes older backups (and stopped runs' partial folders after a day); the schedule and the encrypted off-server copy are HVL's (`NFR-002`, `DATA-004`, [runbook.md](../ops/runbook.md) §6) |
| A data-subject export file | Until handed to the DPO | The operator, per the runbook | Manual (R21) |

## 9. Data subjects' rights

| Right | How it is met | Gaps |
|---|---|---|
| Information (Art. 13) | The privacy notice `/personvern` in `nn`, `nb` and `en`, linked from the player's footer (`DATA-006`) | Some lines need review against what was built (R32) |
| Access (Art. 15) | The data-subject CLI's `export`: one JSON document with every row under the person's pseudonyms, for every year whose secret is still configured, plus their portal login events; via the DPO (D-108) | Canvas's own data (the gradebook) goes through HVL's Canvas routine; rows of a year whose secret is destroyed can no longer be found, by design |
| Rectification (Art. 16) | Learner data record what the learner did and are not edited. A staff display name comes from Feide at each staff login *(verify)* | — |
| Erasure (Art. 17) | The CLI's `erase` (a dry run first, then `--confirm`); the yearly purge for everyone | Staff members' own data and staff-kind accounts are handled by hand (R22, Q6); the person's `AuthAuditEvent` rows are kept (R16); backups keep erased rows up to 30 days, and a restore must repeat erasures (runbook) |
| Restriction (Art. 18) | No tool; by hand with the DPO | — |
| Portability (Art. 20) | Does not apply to processing under Art. 6(1)(e) (Art. 20(1)(a)); the access export is machine-readable JSON anyway | — |
| Objection (Art. 21) | Applies, since the basis is Art. 6(1)(e) | No technical way to stop capturing one learner's statements while they use the activities (R34) |
| Automated decisions (Art. 22) | None. A formative score is the activity's own score, labelled formative; teachers decide grades | — |

## 10. Security measures

| Measure | What | Status |
|---|---|---|
| Pseudonymisation | Learners only as `learnerKey` (yearly secret) and `subjectHash` (stable key with a rotation rule) (D-011, D-055) | Built, tested (`DATA-002`) |
| Minimisation | `DATA-012`'s fields only; the LTI claim allowlist (D-052); Canvas `privacy_level` `anonymous`; no learner names or e-mail (database `CHECK`) | Built, tested |
| Encryption in the application | The Canvas `sub`, Feide's ID token in the session, LTI private keys and access tokens, under `DATA_ENCRYPTION_KEYS` (D-056) | Built |
| *k*-suppression | `INS-006` with complementary suppression, parts other views give away, fixed periods ending at midnight, one course at a time, no period across 1 August (D-106 and its amendments); the mappe's two-sided rule (D-095) | Built; property tests, an exhaustive test of every group of two to five cells for *k* = 3–6 |
| Access control | Roles from Feide at login or from the launch; insight only for an activity's owner, co-authors and the course's Canvas authors (`INS-007`); admin only through `ADMIN_FEIDE_IDS` with Feide, never through Canvas; library installation admin-only | Built, tested |
| Encryption in transit | TLS everywhere; production refuses a database URL without `sslmode`, `redis://` and an http S3 endpoint (D-109). TLS 1.2 or later (`DATA-004`) is Node 24's default minimum for the server's own connections; the TLS settings of the reverse proxy in front of the server are HVL's | Built, tested (`DATA-004`); the proxy's settings are a deployment-checklist item (D-110) |
| Location | Production refuses storage outside an EEA allow-list (D-109) | Built; the hosting facts are HVL's (Q5, R24) |
| Least privilege in the database | Roles `hvli_migrator`, `hvli_app` and `hvli_analytics`; the app may only add and read audit rows; analysts read only *k*-suppressed views (D-109) | Built, tested against PostgreSQL 16; HVL creates the roles (§11) |
| Audit | Insight views and exports, co-author changes, publishing, sharing, grade-sync retries, purge runs, data-subject requests; logins and author launches (D-064) | Built (`DATA-007`); deletion after 2 years not built (R27) |
| Logs | Redaction by key; the request log names route patterns only, never paths, queries, users or IP addresses (D-109) | Built, tested (`DATA-009`, `NFR-006`) |
| The browser | Strict CSP; no third-party scripts, fonts or trackers (`DATA-011`) except Panopto's embed script where configured (D-070); `__Host-` cookies; the ltik in memory only. H5P's player is given an empty user, so H5P never writes its own tracking ID (`H5PUserUUID`) into the browser | Built, tested |
| Cookies and browser storage | Only what the service needs: the portal session and the login transaction (`__Host-` cookies); a Canvas launch relies on no cookie (`LTI-003`). Browser storage: during a Canvas launch, ltijs keeps a random state value in the tool's `localStorage` (or Canvas's platform storage) and removes it when the launch completes (D-050); in the editor, H5P keeps its copy-and-paste clipboard (`h5pClipboard`) and some editor display settings in `localStorage`, for authors only. No learner data is kept in the browser | No consent banner, on the assumption that all of these are strictly necessary *(DPO: confirm under the Norwegian cookie rule, which covers browser storage too)* |
| Uploaded files | SVG sanitised and file types sniffed on both upload paths (CVE-2025-7062 is unpatched in Lumi 10.0.4); user files served with `CSP: sandbox` and `nosniff`, the player's from a separate files origin with no cookie or ltik; ClamAV on both upload paths, failing closed, required in production | Built and tested (`SEC-001`…`SEC-006`, D-045, D-110's amendments of 2026-11-05); the editor's files stay on the app origin (`SPEC-DEVIATION: D-110`); `files.<host>` is the same site as the app (Q5) |
| Rate limits | Statements, insight, co-author search, copies, grade-sync retries | Built |
| Development | Synthetic data only, never production copies (`DATA-010`); pinned dependencies with licence and advisory checks; every requirement has tests; independent reviews with mutation checks | Built |
| Operations | Runbooks for the purge, data-subject requests and database roles; backup, restore and the deployment checklist | Built: the runbooks in `docs/ops/`, the backup and restore CLI with its round-trip test, the deployment checklist ([runbook.md](../ops/runbook.md) §9); running them is HVL's |

## 11. Status of spec 05's data-protection requirements

| ID | Asks | Status 2026-11-05 | Evidence | Needs HVL |
|---|---|---|---|---|
| `DATA-001` | Inventory of every stored field | Done | [DATA-INVENTORY.md](DATA-INVENTORY.md); `npm run privacy:inventory-check` in CI | — |
| `DATA-002` | Pseudonymous learners | Built | Key derivation and schema tests | The yearly secrets in HVL's secret store |
| `DATA-003` | Yearly purge | Built (D-107) | Time-travel integration test, runbook | The real runs; destroying each year's secret (R15) |
| `DATA-004` | EEA, TLS 1.2+, encryption at rest, encrypted backups for 30 days | Start-up checks built (D-109) | Tests; [database-roles.md](../ops/database-roles.md) | Hosting facts, encryption at rest, backups (Q5); the deployment checklist (S6 step 6) |
| `DATA-005` | This input | Written | This file | The DPO's DPIA (Q6) |
| `DATA-006` | Privacy notice | Built (S4) | `/personvern` | Review the text (R32) |
| `DATA-007` | Audit log, 2 years | Built | Integration tests; append-only for the app role | The 2-year deletion (R27, Q26) |
| `DATA-008` | Data-subject requests | Built as an operations CLI (D-108) | Integration tests, runbook | The DPO's process; staff requests (Q6) |
| `DATA-009` | No personal data in logs, 30 days | Built | Redaction tests, request-log tests | The log store's 30 days; the reverse proxy's log (R26) |
| `DATA-010` | Separate database roles; migration role in CI/CD only; no production data in development | Built as scripts and tests (D-109) | Role tests against PostgreSQL; the runbook | The checklist below |
| `DATA-011` | No third-party tracking or CDNs | Built (S4) | Network-recording browser tests | Which Panopto origin to list (F9) |
| `DATA-012` | Minimal xAPI | Built, with two extra fields (`academicYear`, `testUser`; `SPEC-DEVIATION` D-107, D-102) | Mapper tests | — |

**`DATA-010` checklist for HVL** (the runbook [database-roles.md](../ops/database-roles.md) has the commands):

- [ ] *HVL's database administrator:* run `01-roles.sql` once per database; set the three roles' passwords with psql's
      `\password`, or use certificates.
- [ ] *HVL IT, CI/CD:* keep the migration URL (`hvli_migrator`, `?sslmode=require&sslaccept=strict`) in the
      deployment's secret store, given only to the migrate step; the server's environment holds only the app URL
      (`hvli_app`, `?sslmode=verify-full`).
- [ ] *CI/CD:* the migrate step runs `views-down`, `prisma migrate deploy` and `grants`, in that order, stopping at the
      first failure.
- [ ] *HVL IT:* analysts get `hvli_analytics` only (the *k*-suppressed views; R25), and only once the owner has named
      who analyses what (P10, O15). Giving it to a researcher is research use and waits for the DPO (Q25,
      [research-export.md](research-export.md) §2).
- [ ] *HVL IT:* production backups are restored only in production; development and test use synthetic data (seed
      scripts, fixtures, the mock Canvas and Feide).
- [ ] *HVL IT:* run the runbook's «Check it» queries after set-up and keep the output as evidence.

## 12. Risks and residuals

The main risks, how the design meets them, and the residuals left for decision:

| Risk | Mitigations | Residuals |
|---|---|---|
| A teacher singles out a learner from aggregates (differencing, small groups, rates) | *k* = 5; complementary suppression; fixed periods ending at midnight; one course and version at a time; no period across 1 August; test students left out | R1–R4, R6–R8, R10, R13, R14, R36 |
| Someone with database access links pseudonymous rows to people | Secrets apart from the database; yearly destruction; database roles; analysts see views only | R15, R16, R24, R25 |
| Raw identifiers or tokens leak | Short retention, encryption, logs without personal data, the ltik in memory | R5, R21, R23, R26, R29 |
| Data kept longer than needed | Yearly purge, clean-up jobs, Redis expiry | R15, R17, R18, R27, R28 |
| Data used for another purpose (surveillance, grading, research) | Purposes in §2, formative labels, research needs its own basis | R33, R40, Q25 |
| Wrong numbers mislead a teacher (accuracy, Art. 5(1)(d)) | Explanations on the tab | R9, R11, R12 |
| Rights not met | The data-subject CLI, audited; the runbook | R19, R20, R22, R34 |
| Personal data where the design does not expect it | Cut and suppressed free text; author guidance | R30, R31, R35, R37 |
| Learners not told what happens | `/personvern` | R32 |

Each residual is a risk that a decision accepted, narrowed or left open. **Who decides** names the role that can
accept it or ask for a change; a change comes as an amendment of the decision named. R1–R9 keep their numbers,
which the decisions cite.

| # | Residual | Mitigation in place | Decided in | Who decides | Options |
|---|---|---|---|---|---|
| R1 | **Grade-sync counts in colleagues' courses.** The counts of scores sent to Canvas, pending, failed and orphaned are not *k*-suppressed (spec 05 §3 exempts them; D-104, D-106), and since 2026-11-04 there is one count per learner and placement, so a count can be about one learner. In `/app/play`, a Canvas author sees only the course of the launch, whose gradebook shows each learner's score anyway. On the activity page, the owner and co-authors see the counts of every course the activity is placed in, also a colleague's course that placed it from the content bank or copied it, where they are not teachers | Numbers per course only: no name, learner key, Canvas ID, score or error text | D-106, D-104, Q22 | DPO with the owner | Keep; suppress counts below *k* for courses the viewer does not teach; or show owners and co-authors only courses they launched as teachers |
| R2 | **Insight in colleagues' courses.** An owner or co-author sees *k*-suppressed aggregates for every course their activity is placed in, including a colleague's; spec 05 §3's "data from other courses' contexts" can be read to forbid it | Suppression; one course at a time; every view audited | D-106 | DPO with the owner | As R1, for insight |
| R3 | **Two views on consecutive days** *(corrected 2026-11-05)*. Every period now ends at the latest midnight in Oslo, so two views of the same period on the same day are identical whatever is stored in between. The mappe's export reads only rows stored before the same midnight (the step-5 review), so two exports on one day are identical too, and an export less insight's `semester` view (one course, one version) gives nothing of today's learners. Views (and exports) on two consecutive days still differ by one day's learners: a teacher who knows that one learner played yesterday can read that learner's cells from the difference, below *k* | Insight's periods and the mappe end at midnight (D-106's amendments of 2026-11-04 and 2026-11-05), so never within a day | D-106 and its amendments | Owner and ALU (Q24), then the DPO | Accept the daily view (the default); or publish a new view only after *k* new learners (Q24), which can leave a small course without new numbers for days |
| R4 | **0 % and 100 %.** A rate of 0 % or 100 % over at least *k* learners tells what every learner in that group did; insight shows it, because "nobody got question 3 right" is what a seminar needs | Shown only over *k* or more learners; the mappe and the purge's snapshots hide them (D-095) | D-106 | DPO | Accept, or hide them in insight as the mappe does |
| R5 | **The encrypted Canvas user ID.** `GradeSyncJob.ltiSubEncrypted` is the only raw learner ID kept after a launch's 24 hours. Each new scored result reopens the learner's job and writes it again, so it is kept while the learner plays and for 30 days after the last send | Encrypted in the application (D-056); never exported or logged; hourly clean-up | D-104 and its amendment of 2026-11-04, `DATA-002` | DPO | Accept the period, or shorten it |
| R6 | **A share that gives a small count or a bound** *(corrected 2026-11-05)*. `INS-002`'s share right is shown when *k* or more learners answered, so 10 % of 20 tells that 2 answered right, a count `INS-003` hides. For a question with several right options or a task with several gaps, the share fully right also sets a lower bound on every right option's or gap's count, hidden or not | A single-answer question and a one-gap task are suppressed as two parts so the share gives nothing more away (D-106's amendment) | D-106 and its amendment of 2026-11-04 | DPO | Accept; or show a share only when right and wrong each number at least *k* |
| R7 | **One learner per cell.** When *k* or more learners each chose a different option and no option or «no answer» is empty, every option count is hidden, yet each must be 1 | The answers are not linked to anyone; the exhaustive test allows exactly this case | D-106's amendment of 2026-11-04 | DPO | Accept; or hide such a question's learner count |
| R8 | **Nested periods** *(corrected 2026-11-05)*. The periods are nested (7 ⊂ 14 ⊂ 30 days ⊂ the semester) and end at the same midnight, so a teacher who opens two of them on the same day sees the learners active only in their difference: 30 started in 14 days and 29 in 7 days means one learner played only on days 8–14, and that learner's first answers shift the option counts. In August the shortened periods (they start no earlier than 1 August) nest the same way. The mappe's semester groups end at the same midnight (D-106's amendment of 2026-11-05), so an export nests with these periods as the `semester` view does and adds no difference within a day | Fixed periods only; no free start date; the mappe ends at the same midnight (D-106 and its amendment of 2026-11-05) | D-106 and its amendments | DPO | Accept; or show the longer periods only as weekly snapshots |
| R9 | **What a number means.** A "first answer" is the first within the chosen period; answers H5P accepts as small spelling errors are listed as wrong in the answer distribution. Neither identifies anyone, but a teacher may misread a group (accuracy) | Explained on the tab; summaries name the hardest question or most common answer "of those that can be shown" (D-106's amendment) | D-106's amendment of 2026-11-04, D-115 | DPO, ALU | Accept with the explanations; or a period-free "first answer" |
| R10 | **An erasure changes past days.** A data-subject erasure (D-108) or a deleted activity changes earlier days' rows, so a view taken before and after it differs by that learner's rows, even within a day | Rare, run by operations on the DPO's instruction; the tab says nothing about what was erased or whom | D-106's amendment of 2026-11-04 | DPO | Accept |
| R11 | **The completion rate's base.** The course count (NRPS) can change within a day, and with it the base of the completion rate; if Canvas's roster lists the test student, the base is one too high *(verify, TeCopp)*. *(Updated 2026-11-05, integration:)* `main.ts` now passes `CANVAS_ORIGINS` to the roster reader as to the grade worker, so a roster on HVL's Canvas domain is read once that origin is in `CANVAS_ORIGINS`; any other origin is still refused | The count is Canvas's aggregate; a refusal fails closed and logs the origin only | D-106's amendment of 2026-11-04 | TeCopp (verify); HVL IT (`CANVAS_ORIGINS`) | Keep |
| R12 | **The 1 August tail.** A portal session keeps the old year's key up to 12 hours past 1 August (D-057). A learner active only then is in no insight view and no mappe group, and their rows form a purge-snapshot group of their own, normally below *k* and left out | Each view and snapshot reads one stored year (D-106, D-107) | D-106, D-107 | DPO | Accept (accuracy only) |
| R13 | **Canvas test students.** A teacher's Student View rows are stored, flagged and graded, so passback can be tested; they are left out of every insight and mappe aggregate and of the purge's snapshots, though their grade jobs are in the grade-sync counts (R1). They are recognised only by the LTI `TestUser` role: a platform that sends no such role would have them counted as learners, and *k* − 1 fake learners beside one real one would expose that learner | The flag, set from the launch (D-102's amendment of 2026-11-04) | D-102 | TeCopp (verify that Canvas sends the full `TestUser` URI and that «Reset Student» gives a new `sub`); DPO | Accept once verified |
| R14 | **Differences between shown counts.** Two shown counts can differ by less than *k*: 7 started and 6 completed tells that one learner started without completing; a video task answered by 6 of 7 likewise. No one is named, but a teacher who knows who was absent learns something | Both counts are over *k* | D-106 | DPO | Accept; or suppress a difference below *k* (hides much of the tab) |
| R15 | **The ended year until the purge and the secret's destruction.** From 1 August to the run date (at least 30 days; by default 31 August) the ended year's learner rows remain by design. Until operations destroy that year's secret, the database and its 30-day backups stay linkable to people. Destroying it is a manual step; the server only names stale secret years at start-up and after each completed run | Runbook with checks; start-up warning (D-107) | D-107 | HVL operations; DPO (the period) | Accept; add the step to HVL's yearly operations calendar |
| R16 | **The authentication audit after a purge or an erasure.** The purge deletes learner `Identity` rows created before 1 August, also for learners active in the new year. Their `AuthAuditEvent` rows (kept 2 years) keep a dangling account ID and an `ipHash` that stays linkable to an IP address while its `IDENTITY_HASH_KEYS` key exists. A data-subject erasure keeps those rows too (D-108) | No identifier finds them once the account is gone; the hash key is rotated by rule (D-055) | D-108, D-064, D-055 | DPO (Q6) | Keep for security; or delete a person's `AuthAuditEvent` rows at erasure |
| R17 | **Small leftovers.** A learner account created in the current year and left without an identity (its platform removed) stays until the next purge; it holds an ID, a kind and a time | The next purge deletes it | D-107's amendment of 2026-11-04 | DPO | Accept |
| R18 | **Snapshots outlive the year.** A suppressed snapshot still shows that between 1 and *k* − 1 learners played that activity in that course and version that year, as insight's suppressed cells do; snapshots stay as long as the activity | Aggregates only; the mappe's rules (D-095) | D-107 | DPO | Accept; or drop suppressed snapshots |
| R19 | **A race at login.** If the purge deletes a learner's identity between the moment a login reads it and the moment that login makes the account staff, the person gets a staff account (with a display name) that no login reaches, until HVL removes it by hand | The purge repeats its filter in each delete (D-107's amendment). *(Fixed 2026-11-05, integration:)* `AccountResolver` makes an account staff only while the identity it read still exists, in one statement, and otherwise starts the login over as a first login (`accountPurgeRace.int.test.ts`); only the window inside that statement remains | D-107's amendment | Owner | Keep |
| R20 | **An erasure without an audit event.** A run ended by `SIGKILL`, Ctrl-\ (`SIGQUIT`), out-of-memory or a host crash during `erase --confirm` can delete rows and write no audit event | Ctrl-C, `SIGTERM` and `SIGHUP` are held until the run is audited; the runbook says to note it in the DPO's case file and run the erasure again, which is audited (D-108's amendment of 2026-11-05) | D-108 | DPO | Accept |
| R21 | **The operator's terminal and files.** The identifiers pasted on standard input are echoed and can stay in scrollback, `tmux` logs or a jump host's session recording. The operator's own Feide ID (never the data subject's) is in the command's arguments, so in shell history and the process list, and in npm's debug log unless `--logs-max=0` is given. The export file holds the person's data on the server's disk until it is deleted | Runbook: clear the scrollback, `--logs-max=0`, `umask 077`, export only to a file or pipe (the CLI refuses a terminal), hand the file to the DPO and delete it | D-108 and its amendments | HVL operations; DPO | Accept with the runbook |
| R22 | **Staff-kind accounts and staff requests.** For a student whose account is of kind staff (a student author, D-059, or a student Canvas launched as teacher or TA), the CLI erases the learner rows but keeps the account and any display name. A staff member's own data (account, name, authored content, co-authorships, audit events) is outside the CLI | The CLI counts such accounts (`staffAccounts`); the runbook says to handle them by hand | D-108 | DPO (Q6) | Decide the manual routine, or a staff deletion tool |
| R23 | **The storage endpoint from an AWS config file.** The AWS SDK can read an `endpoint_url` from `~/.aws/config` (`AWS_CONFIG_FILE`, `AWS_PROFILE`), which would send files past the TLS and EEA checks. The environment variables for this are refused in production; the file is not visible to the server | *(Fixed 2026-11-05, integration:)* the S3 client ignores configured endpoints (`ignoreConfiguredEndpointUrls`), so neither the variables nor the file can move the storage (`test/infra/s3Client.test.ts`); the deployment checklist still says no AWS config file is mounted | D-109's amendment of 2026-11-05 | HVL IT | Keep |
| R24 | **Where the data actually lives.** The storage allow-list catches a wrong setting, not where a server stands. The database and Redis hosts are named in the start-up log but not judged; the EEA location, encryption at rest and the backups are the deployment checklist's evidence. The region and domain lists are marked *(verify)*. The check judges the region and endpoint, so production also takes plain bucket names only: an access point or Outposts ARN in `S3_CONTENT_BUCKET` or `S3_TEMPORARY_BUCKET` would send the files to the ARN's own region, past the allow-list (found in the step-5 review); an access point alias (`…-s3alias`) is a plain name and stays in the client's region | Start-up checks (TLS, the EEA allow-list, plain bucket names, no AWS SDK endpoint variables) and log line (D-109 and its amendments of 2026-11-04 and 2026-11-05) | D-109 and its amendments | HVL IT (Q5) | Provide the provider's facts for the checklist |
| R25 | **The analytics role.** `hvli_analytics` can read PostgreSQL's system catalogues (table, column and view names, and the view's definition), as every role can; it reads no row except `analytics.insight_snapshot`. During each deployment's migrate step the views are dropped and analysts' queries fail until the grants step rebuilds them. On development and CI database servers the role test leaves the three roles with a published test password, with privileges only in throwaway databases (it refuses any server not on the same machine) | The barrier is the missing grants; read-only sessions | D-109 and its amendments | DPO; HVL IT | Accept |
| R26 | **Logs outside the application.** The reverse proxy's own access log is outside the app and must not log the query string, because some H5P paths accept `?ltik=`. The request log names route patterns only; it relies on no router being mounted on a path with parameters, which a source scan checks for literal mounts but cannot prove for a path held in a variable or added by a dependency | Request log built that way; a source scan (D-109) | D-109 | HVL IT (the proxy's log format) | Configure the proxy to log the path without the query |
| R27 | **Audit records are not deleted after 2 years.** `DATA-007` keeps them 2 years, but nothing deletes `AuditEvent`, `AuthAuditEvent` or `LibraryAuditEvent` rows yet, and D-109 lets the app's role add and read them only, so a flaw in the app cannot erase the trail | No production rows exist yet; the first are due for deletion 2 years after the pilot starts | D-109's amendment of 2026-11-04 (the deletion "needs its own amendment and grant") | Owner and HVL IT (Q26) | A deletion job with its own role and grant; or an operations step in a runbook |
| R28 | **Staff accounts are never deleted automatically.** A staff member who leaves HVL keeps their account, display name, ownership and co-authorships; they stop being findable in co-author search 13 months after their last staff login (D-090) | Not findable after 13 months; deletion by hand | D-090, D-108 | HVL (DPO, HVL IT) (Q27) | A routine when people leave, for example on HVL's leaver list |
| R29 | **Feide's e-mail scope.** The login asks Feide for `email` although nothing uses it since D-090's amendment; the address sits in the encrypted ID token in the session for at most 12 hours. `groups-edu` releases all of a person's FS course groups, read in memory only to find student authors | Not stored in any table; encrypted in the session | D-090's amendment of 2026-10-29, `AUTH-001` | DPO and owner | Accept; or drop `email` from the scope (an `AUTH-001` change and the Feide client's attribute groups) |
| R30 | **Free text from learners.** Gap answers (cut to 100 characters per gap) are stored, and saved progress holds whatever a learner typed. A learner could type a name or special-category data (for example a patient's details in a nursing task) | A typed answer is shown to teachers only when *k* or more learners gave the same normalised answer (`INS-003`); yearly purge; access and erasure through the CLI | D-115, D-106 | DPO; ALU (guidance) | Accept with guidance to authors not to write tasks that invite personal data |
| R31 | **Personal data in authored content.** Cases, photos, videos and H5P metadata can name or show people; the content bank shares listed activities with HVL staff, and copies keep the content | The author's responsibility; nothing checks content for personal data | D-091, D-092 | ALU and the DPO (author guidance, Q17) | Guidance for authors; a line in the bank's consent text |
| R32 | **The privacy notice and what was built.** `/personvern` says administrators see data "only through a support action that is logged", which is not built: admins see no insight (D-106), while HVL operations hold the database and run the data-subject CLI. It does not mention the grade-sync counts that activity owners see per course (R1), Canvas's test student, the 31 August default date (it says "30 days after the academic year ends"), or the right to object (R34). It states as done what is not yet: that the login log "is deleted after 2 years" (no job does it, R27), that "the key for that academic year is destroyed too" (a manual operations step, R15), and that the data "is stored encrypted in Norway or the EEA" (the hosting facts are open, Q5, R24). It does not say that students may read aggregates as TAs or student authors (R36), or that people from other Feide organisations can use the portal (R37) | The notice is short and correct on the main points (pseudonyms, *k*, retention, Canvas ID) | `DATA-006`, D-106, D-107, D-108 | DPO, then the owner (the web app's texts in `nn`, `nb` and `en`) | Update the text after the DPO's review |
| R33 | **The audit log used for pilot measures.** Spec 00 §8 measures from the audit log the time from creating to publishing a first activity and whether pilot teachers opened *Før samlinga* before their seminars: staff data used for an evaluation, beyond security | The events hold no learner data; `insight.view` holds no counts or answers | Spec 00 §8, D-106 | DPO; owner with Pedagogisk akademi | Report only aggregates without names; tell staff in `/personvern`; or measure another way |
| R34 | **Objection (Art. 21).** A learner who objects cannot stop the capture of their statements while they keep using activities; there is no per-person opt-out, and adding one would mean storing a list of the people who objected | An erasure after the objection (the CLI), repeated as needed | — | DPO with the owner (Q28) | Accept with a manual routine; or an opt-out feature (its own decision) |
| R35 | **Panopto in the learner's browser.** Where an author embeds a Panopto video, the learner's browser loads the video from HVL's Panopto and Panopto's embed script from `developers.panopto.com`, a third-party script without integrity check (D-070); Panopto sees the IP address and its own session | Only origins HVL lists; never YouTube; CSP limits the script to that one file | D-070 | HVL IT (Panopto agreement and hosting) and the DPO | Accept; or host the embed script ourselves (a code change) |
| R36 | **Students who read insight** *(added 2026-11-05)*. Insight and the grade-sync counts go to anyone with the author role in a context: Canvas gives it to TAs (`LTI-004`), who at HVL can be student assistants, and in the portal a student author (`AUTHOR_COURSE_GROUPS`, D-059) who owns an activity sees it for every course the activity is placed in. A student may so see *k*-suppressed aggregates about fellow students, possibly in their own year | Aggregates only, *k*-suppressed; one course at a time; every view audited; student authors share only `private` (D-059) | `INS-007`, D-106, D-059 | DPO with the owner (Q30) | Accept (with HVL's confidentiality terms for student assistants); or show insight only to staff by Feide affiliation, and to Canvas instructors but not TAs |
| R37 | **Learners from outside HVL** *(added 2026-11-05)*. The recommended Feide registration leaves «Restrict login to selected organizations» off (`docs/reference/feide-values.md`), so anyone with Feide can log in as a learner and play activities shared with «anyone with Feide» (spec 02's role table, D-059); their play is stored and counted like an HVL student's. Feide also serves schools, so pupils, who may be children, could be among them (Art. 8, recital 38). HVL's public-interest task in higher education may not cover them (§2) | Learner role only; they see only `feide`-visible activities; the same pseudonyms, *k*-suppression and purge | D-059, `AUTH-002` | Owner, HVL IT (Feide's «Restrict login to selected organizations») and the DPO (Q29) | Restrict the Feide registration to HVL (and named partners); or keep it open, tell such users in `/personvern`, and let the DPO confirm the basis |
| R38 | **Uploaded files at the scanner** *(added 2026-11-05)*. Every upload, which can hold personal data (a photo, a document), is streamed to HVL's clamd before it is stored. clamd's own log may record a finding's signature; clamscan writes socket and TLS errors to standard error outside our logger (Node error text; for a certificate mismatch the peer certificate, never a file name or content); with `DEBUG=h5p:*`, Lumi would log the paths of scanned files | Fail closed; TLS off the loopback in production; our line holds a reason code and at most five signature names filtered to safe characters; `DEBUG` off in production (runbook) | `SEC-006`, `DATA-004`, `DATA-009`, D-110 | HVL IT (clamd and its log) | Accept, with clamd on HVL's own hosts in the EEA and its log under the 30-day rule |
| R39 | **Build-machine details in learner-facing JavaScript** *(added 2026-11-05)*. The build of two third-party H5P libraries writes values from the build machine's environment into JavaScript that some content types send to every learner. Since the fix it holds only paths under the build cache, `HOME`, `NODE_ENV` and npm's versions; packages built before the fix could carry secrets of the build machine | Libraries are built with a minimal environment (`buildEnv` 3, `tools/h5p-libraries`); the bundle refuses packages with secret-named variables; builds made before the fix were removed here (the last copies on 2026-11-06), none was ever made public, and the owner deleted the codespaces that could have built with the old recipe (no Codespaces secrets existed; D-110's amendment of 2026-11-06); a library storage seeded before the fix must have the affected library folder deleted before re-seeding (`npm run libraries:check` names it), because seeding keeps an installed library of the same patch version | `H5P-003`, `DATA-009`, D-110, D-112 | The owner and HVL (production packages built in CI only, where the paths are the runner's); upstream (D-112) | Build production packages only in CI; report the build fault upstream, privately (D-112) |
| R40 | **Employees as learners** *(added 2026-11-05)*. In Canvas only the launch's roles decide who is a learner (`mapLtiRoles`, D-102), and the server does not tell an HVL employee from a student: it ignores every institution role but Administrator, which makes a Canvas account administrator an author in every course (D-059), and under `anonymous` Canvas sends no name or e-mail. An employee enrolled as a Student, for example in ALU's university-pedagogy course, has their statements stored, counted in that course's insight and in the mappe of the activity's owner and co-authors, and, in a graded placement, sent as a formative score to the gradebook. The colleagues who teach the course, and the activity's owner and co-authors (§7), see *k*-suppressed aggregates of it: learning data about employees, in an employment context. In the portal HVL staff log in as authors, so their plays there are not captured | Pseudonyms, *k*-suppression, aggregates only, formative only, yearly purge | D-102, `LTI-004` | DPO (Q6) | Accept, and tell staff in `/personvern` and in the course; or place only ungraded activities in staff courses |

## 13. Questions for the DPO

1. Is Art. 6(1)(e) the right basis for learners' data, and which provision of Norwegian law supplements it? And for
   staff data (§2), including employees who are learners in a Canvas course (R40)?
2. May the cookies in §10 be set without consent as strictly necessary?
3. For each residual R1–R40: accept, or which option? R1, R2, R3 and R36 also need the owner's view (Q22, Q24,
   Q30).
4. Should `AuthAuditEvent` rows be deleted with a person's other data at erasure (R16), and how should staff members'
   own requests and staff-kind accounts of students be handled (R22, Q6)?
5. Which routine handles an objection (R34, Q28) and a staff member leaving HVL (R28, Q27)?
6. Does the privacy notice need the changes in R32?
7. Research: what basis and approval would an anonymised research export need ([research-export.md](research-export.md),
   Q25)? Nothing is built until then.
8. May people from other Feide organisations, possibly school pupils, use the portal as learners, and on which basis
   (R37, Q29)? Which purpose and which analysts does the read-only analytics role serve (P10, O15)?
